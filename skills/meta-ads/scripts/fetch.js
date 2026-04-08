#!/usr/bin/env node
// Meta Ads Dashboard — Noblus® KPIs
// Usage: node --env-file=.env fetch.js [--days 7] [--level account|campaign|adset|ad]

const API_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${API_VERSION}`;

function parseArgs(argv) {
  const args = { days: 7, level: 'campaign' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--days' && argv[i + 1]) args.days = parseInt(argv[++i]);
    if (argv[i] === '--level' && argv[i + 1]) args.level = argv[++i];
  }
  return args;
}

async function apiFetch(path, params) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message || `API error ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function getAdAccounts(token) {
  const data = await apiFetch('me/adaccounts', {
    fields: 'name,account_id,currency,account_status',
    access_token: token,
  });
  return data.data;
}

function datePreset(days) {
  const presets = { 7: 'last_7d', 14: 'last_14d', 28: 'last_28d', 30: 'last_30d', 90: 'last_90d' };
  return presets[days] || null;
}

function timeRange(days) {
  const until = new Date();
  const since = new Date();
  since.setDate(until.getDate() - days);
  return JSON.stringify({
    since: since.toISOString().split('T')[0],
    until: until.toISOString().split('T')[0],
  });
}

async function getInsights(accountId, token, days, level) {
  const fields = [
    'campaign_name',
    'adset_name',
    'ad_name',
    'spend',
    'impressions',
    'reach',
    'frequency',
    'cpm',
    'ctr',
    'inline_link_clicks',
    'inline_link_click_ctr',
    'actions',
    'action_values',
    'purchase_roas',
    'video_p25_watched_actions',
    'video_p50_watched_actions',
    'video_thruplay_watched_actions',
  ].join(',');

  const preset = datePreset(days);
  const params = { fields, level, access_token: token };
  if (preset) {
    params.date_preset = preset;
  } else {
    params.time_range = timeRange(days);
  }

  const data = await apiFetch(`act_${accountId}/insights`, params);
  return data.data;
}

function findAction(actions, type) {
  if (!Array.isArray(actions)) return 0;
  const a = actions.find(x => x.action_type === type);
  return a ? parseFloat(a.value) : 0;
}

function calcMetrics(insight) {
  const spend = parseFloat(insight.spend || 0);
  const impressions = parseInt(insight.impressions || 0);
  const reach = parseInt(insight.reach || 0);

  // ROAS
  const roas = insight.purchase_roas?.[0]?.value
    ? parseFloat(insight.purchase_roas[0].value) : 0;

  // Compras e carrinhos
  const purchases = findAction(insight.actions, 'purchase');
  const addToCart = findAction(insight.actions, 'add_to_cart');

  // CAC e CPA
  const cac = purchases > 0 ? spend / purchases : 0;
  const cpaCart = addToCart > 0 ? spend / addToCart : 0;

  // Hook Rate (3s): video_view actions = 3-second views
  const views3s = findAction(insight.actions, 'video_view');
  const hookRate = impressions > 0 ? (views3s / impressions) * 100 : 0;

  // Hold Rate (50% do vídeo ou thruplay, o que estiver disponível)
  const views50pct = findAction(insight.video_p50_watched_actions, 'video_view');
  const viewsThruplay = findAction(insight.video_thruplay_watched_actions, 'video_view');
  const holdViews = views50pct || viewsThruplay;
  const holdRate = impressions > 0 ? (holdViews / impressions) * 100 : 0;

  // CTR Link, Frequencia, CPM
  const ctrLink = parseFloat(insight.inline_link_click_ctr || 0);
  const frequency = parseFloat(insight.frequency || 0);
  const cpm = parseFloat(insight.cpm || 0);

  return { spend, impressions, reach, roas, purchases, addToCart, cac, cpaCart, hookRate, holdRate, ctrLink, frequency, cpm };
}

function brl(v) {
  return `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function pct(v) { return `${v.toFixed(2)}%`; }

function icon(v, good, warn) {
  if (v >= good) return '✅';
  if (v >= warn) return '⚠️ ';
  return '❌';
}

function freqIcon(v) {
  if (v <= 3) return '✅';
  if (v <= 4.5) return '⚠️ ';
  return '❌';
}

function printInsight(insight, label) {
  const m = calcMetrics(insight);

  console.log(`\n${'─'.repeat(62)}`);
  console.log(`📊  ${label}`);
  console.log(`${'─'.repeat(62)}`);
  console.log(`💰  Investimento:      ${brl(m.spend)}`);
  console.log(`👁   Impressões:        ${m.impressions.toLocaleString('pt-BR')}`);
  console.log(`👤  Alcance:           ${m.reach.toLocaleString('pt-BR')}`);
  console.log('');
  console.log('📈  EFICIÊNCIA E LUCRO');
  console.log(`    ROAS:             ${m.roas > 0 ? m.roas.toFixed(2) + 'x' : '—'}  ${m.roas > 0 ? icon(m.roas, 4, 2.5) : ''}`);
  console.log(`    CAC:              ${m.cac > 0 ? brl(m.cac) : '—'}`);
  console.log(`    CPA (carrinho):   ${m.cpaCart > 0 ? brl(m.cpaCart) : '—'}`);
  console.log(`    Compras:          ${m.purchases > 0 ? m.purchases : '—'}`);
  console.log(`    Carrinhos:        ${m.addToCart > 0 ? m.addToCart : '—'}`);
  console.log('');
  console.log('🎬  CRIATIVO');
  console.log(`    Hook Rate (3s):   ${pct(m.hookRate)}  ${icon(m.hookRate, 30, 20)}`);
  console.log(`    Hold Rate (15s):  ${pct(m.holdRate)}  ${icon(m.holdRate, 20, 10)}`);
  console.log(`    CTR Link:         ${pct(m.ctrLink)}  ${icon(m.ctrLink, 1.5, 1)}`);
  console.log('');
  console.log('⚕️   SAÚDE DA ENTREGA');
  console.log(`    Frequência:       ${m.frequency.toFixed(2)}x  ${freqIcon(m.frequency)}`);
  console.log(`    CPM:              ${brl(m.cpm)}`);
}

async function main() {
  const { days, level } = parseArgs(process.argv);
  const { META_ACCESS_TOKEN, META_AD_ACCOUNT_ID } = process.env;

  if (!META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN não definido no .env');

  let accountId = META_AD_ACCOUNT_ID;
  if (!accountId) {
    console.log('🔍 Buscando contas de anúncio...');
    const accounts = await getAdAccounts(META_ACCESS_TOKEN);
    if (!accounts?.length) throw new Error('Nenhuma conta de anúncio encontrada para esse token.');

    console.log('\nContas disponíveis:');
    accounts.forEach((a, i) => console.log(`  [${i + 1}] ${a.name} — ${a.account_id}`));

    accountId = accounts[0].account_id;
    console.log(`\nUsando: ${accounts[0].name} (${accountId})`);
    console.log(`💡 Dica: adicione META_AD_ACCOUNT_ID=${accountId} no .env para fixar essa conta.\n`);
  }

  console.log(`\n🚀 Noblus® Meta Ads Dashboard — Últimos ${days} dias (por ${level})`);

  const insights = await getInsights(accountId, META_ACCESS_TOKEN, days, level);

  if (!insights?.length) {
    console.log('⚠️  Nenhum dado encontrado para o período selecionado.');
    return;
  }

  for (const ins of insights) {
    const label = ins.campaign_name || ins.adset_name || ins.ad_name || 'Conta';
    printInsight(ins, label);
  }

  console.log(`\n${'─'.repeat(62)}`);
  console.log('Legenda:  ✅ Ótimo   ⚠️  Atenção   ❌ Crítico');
  console.log('Metas:    ROAS ≥ 4x | Hook ≥ 30% | CTR ≥ 1.5% | Freq ≤ 3x');
}

main().catch(err => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
