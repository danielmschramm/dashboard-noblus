#!/usr/bin/env node
// Meta Pixel Diagnostics — verifica se eventos estão chegando corretamente
// Usage: node --env-file=.env check-pixel.js [--days 30]

const API_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${API_VERSION}`;

function parseArgs(argv) {
  const args = { days: 30 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--days' && argv[i + 1]) args.days = parseInt(argv[++i]);
  }
  return args;
}

async function apiFetch(path, params) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message || `API error ${res.status}`);
  return json;
}

async function getPixels(accountId, token) {
  const data = await apiFetch(`act_${accountId}/adspixels`, {
    fields: 'id,name,last_fired_time,is_unavailable',
    access_token: token,
  });
  return data.data;
}

async function getPixelStats(pixelId, token, days) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;

  // A API retorna buckets horários paginados — precisamos agregar tudo
  const totals = {};
  let url = new URL(`${BASE}/${pixelId}/stats`);
  url.searchParams.set('start_time', start);
  url.searchParams.set('end_time', end);
  url.searchParams.set('aggregation', 'event');
  url.searchParams.set('limit', 100);
  url.searchParams.set('access_token', token);

  while (url) {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error?.message || `API error ${res.status}`);

    for (const bucket of (json.data || [])) {
      for (const item of (bucket.data || [])) {
        totals[item.value] = (totals[item.value] || 0) + (parseInt(item.count) || 0);
      }
    }

    url = json.paging?.next ? new URL(json.paging.next) : null;
  }

  return totals;
}

async function getPixelDiagnostics(pixelId, token) {
  try {
    const data = await apiFetch(`${pixelId}/diagnostics`, {
      fields: 'diagnostics',
      access_token: token,
    });
    return data.diagnostics?.data || [];
  } catch {
    return [];
  }
}

const CRITICAL_EVENTS = ['Purchase', 'AddToCart', 'ViewContent', 'InitiateCheckout', 'PageView'];

function statusIcon(count) {
  if (count > 100) return '✅';
  if (count > 10) return '⚠️ ';
  if (count > 0) return '🔸';
  return '❌';
}

function timeSince(isoOrUnix) {
  if (!isoOrUnix) return 'nunca';
  const date = typeof isoOrUnix === 'number'
    ? new Date(isoOrUnix * 1000)
    : new Date(isoOrUnix);
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `há ${days} dia${days > 1 ? 's' : ''}`;
  if (hours > 0) return `há ${hours}h`;
  return 'agora mesmo';
}

async function main() {
  const { days } = parseArgs(process.argv);
  const { META_ACCESS_TOKEN, META_AD_ACCOUNT_ID } = process.env;

  if (!META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN não definido no .env');
  if (!META_AD_ACCOUNT_ID) throw new Error('META_AD_ACCOUNT_ID não definido no .env');

  console.log(`\n🔍 Noblus® — Diagnóstico do Pixel Meta (últimos ${days} dias)\n`);

  // 1. Listar pixels da conta
  const pixels = await getPixels(META_AD_ACCOUNT_ID, META_ACCESS_TOKEN);

  if (!pixels?.length) {
    console.log('❌ Nenhum pixel encontrado nessa conta de anúncio.');
    console.log('   → Crie um pixel em Events Manager: business.facebook.com/events_manager');
    return;
  }

  for (const pixel of pixels) {
    console.log(`${'─'.repeat(62)}`);
    console.log(`📡 Pixel: ${pixel.name}`);
    console.log(`   ID:            ${pixel.id}`);
    console.log(`   Último evento: ${timeSince(pixel.last_fired_time)}`);
    if (pixel.is_unavailable) console.log('   ⚠️  Pixel marcado como indisponível pelo Meta');
    console.log('');

    // 2. Eventos dos últimos N dias
    const eventMap = await getPixelStats(pixel.id, META_ACCESS_TOKEN, days);

    console.log(`📊 EVENTOS (últimos ${days} dias):`);

    // Eventos críticos primeiro
    for (const evt of CRITICAL_EVENTS) {
      const count = eventMap[evt] || 0;
      const icon = statusIcon(count);
      const label = evt.padEnd(20);
      console.log(`   ${icon} ${label} ${count.toLocaleString('pt-BR')} disparos`);
    }

    // Outros eventos encontrados
    const others = Object.entries(eventMap).filter(([k]) => !CRITICAL_EVENTS.includes(k));
    if (others.length) {
      console.log('\n   Outros eventos:');
      for (const [name, count] of others) {
        console.log(`      ${name.padEnd(22)} ${count.toLocaleString('pt-BR')}`);
      }
    }

    // 3. Análise do Purchase
    console.log('');
    console.log('🛒 ANÁLISE DO PURCHASE:');
    const purchases = eventMap['Purchase'] || 0;
    const carts = eventMap['AddToCart'] || 0;
    const checkouts = eventMap['InitiateCheckout'] || 0;
    const pageviews = eventMap['PageView'] || 0;

    if (purchases === 0) {
      console.log('   ❌ Nenhuma compra rastreada pelo pixel nos últimos ' + days + ' dias.');
      console.log('');
      console.log('   Causas prováveis:');
      if (pageviews === 0) {
        console.log('   → O pixel provavelmente não está instalado no site (PageView zerado)');
      } else if (carts === 0) {
        console.log('   → PageView OK, mas AddToCart zerado → o evento de carrinho não está disparando');
        console.log('   → Verifique se o código do pixel está na página do produto/carrinho');
      } else if (checkouts === 0) {
        console.log('   → AddToCart OK, mas InitiateCheckout zerado → evento de checkout ausente');
        console.log('   → Adicione o evento na página de checkout da sua loja');
      } else {
        console.log('   → Checkout está sendo rastreado mas Purchase não → evento de compra ausente');
        console.log('   → Adicione o evento Purchase na página de confirmação do pedido');
        console.log('   → Confirme que o evento inclui o parâmetro value (receita)');
      }
    } else if (carts > 0) {
      const convRate = ((purchases / carts) * 100).toFixed(1);
      const icon = parseFloat(convRate) >= 2 ? '✅' : parseFloat(convRate) >= 1 ? '⚠️ ' : '❌';
      console.log(`   ${icon} Taxa de conversão (carrinho → compra): ${convRate}%`);
      if (parseFloat(convRate) < 1) {
        console.log('   → Taxa abaixo de 1%: problema no checkout (frete, pagamento, UX)');
        console.log('   → Ou o Purchase não está disparando em todos os pedidos');
      }
    }

    if (purchases > 0 && carts > 0 && pageviews > 0) {
      console.log('');
      console.log('   Funil completo:');
      console.log(`   PageView → AddToCart: ${((carts / pageviews) * 100).toFixed(1)}%`);
      if (checkouts > 0) {
        console.log(`   AddToCart → Checkout: ${((checkouts / carts) * 100).toFixed(1)}%`);
        console.log(`   Checkout → Purchase:  ${((purchases / checkouts) * 100).toFixed(1)}%`);
      }
    }

    // 4. Diagnostics da API
    const diagnostics = await getPixelDiagnostics(pixel.id, META_ACCESS_TOKEN);
    if (diagnostics.length) {
      console.log('');
      console.log('⚠️  ALERTAS DO META:');
      for (const d of diagnostics.slice(0, 5)) {
        console.log(`   • ${d.description || d.type || JSON.stringify(d)}`);
      }
    }
  }

  console.log(`\n${'─'.repeat(62)}`);
  console.log('💡 Para verificar eventos em tempo real:');
  console.log('   → business.facebook.com/events_manager');
  console.log('   → Instale a extensão "Meta Pixel Helper" no Chrome');
}

main().catch(err => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
