#!/usr/bin/env node
// fetch-multi.js — Noblus® Meta Ads Dashboard Data Collector
// Fetches campaign + adset data for 4 time periods in parallel
// Usage: node --env-file=.env fetch-multi.js [--output path/to/dashboard-data.json]

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${API_VERSION}`;
const PERIODS = [7, 30, 90, 180];
const LEVELS = ['campaign', 'adset'];

function parseArgs(argv) {
  const args = { output: resolve(__dirname, 'dashboard-data.json') };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--output' && argv[i + 1]) args.output = argv[++i];
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

async function getAdAccounts(token) {
  const data = await apiFetch('me/adaccounts', {
    fields: 'name,account_id,currency',
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
    'campaign_name', 'adset_name', 'ad_name',
    'spend', 'impressions', 'reach', 'frequency', 'cpm', 'ctr',
    'inline_link_clicks', 'inline_link_click_ctr',
    'actions', 'action_values', 'purchase_roas',
    'video_p25_watched_actions', 'video_p50_watched_actions',
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
  return data.data || [];
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
  const roas = insight.purchase_roas?.[0]?.value ? parseFloat(insight.purchase_roas[0].value) : 0;
  const purchases = findAction(insight.actions, 'purchase');
  const addToCart = findAction(insight.actions, 'add_to_cart');
  const cac = purchases > 0 ? spend / purchases : 0;
  const cpaCart = addToCart > 0 ? spend / addToCart : 0;
  const views3s = findAction(insight.actions, 'video_view');
  const hookRate = impressions > 0 ? (views3s / impressions) * 100 : 0;
  const views50pct = findAction(insight.video_p50_watched_actions, 'video_view');
  const viewsThruplay = findAction(insight.video_thruplay_watched_actions, 'video_view');
  const holdViews = views50pct || viewsThruplay;
  const holdRate = impressions > 0 ? (holdViews / impressions) * 100 : 0;
  const ctrLink = parseFloat(insight.inline_link_click_ctr || 0);
  const frequency = parseFloat(insight.frequency || 0);
  const cpm = parseFloat(insight.cpm || 0);
  const clicks = parseInt(insight.inline_link_clicks || 0);
  return { spend, impressions, reach, roas, purchases, addToCart, cac, cpaCart, hookRate, holdRate, ctrLink, frequency, cpm, clicks };
}

async function main() {
  const { output } = parseArgs(process.argv);
  const { META_ACCESS_TOKEN, META_AD_ACCOUNT_ID } = process.env;

  if (!META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN não definido no .env');

  let accountId = META_AD_ACCOUNT_ID;
  if (!accountId) {
    console.log('🔍 Buscando conta de anúncio...');
    const accounts = await getAdAccounts(META_ACCESS_TOKEN);
    if (!accounts?.length) throw new Error('Nenhuma conta de anúncio encontrada.');
    accountId = accounts[0].account_id;
    console.log(`   Usando: ${accounts[0].name} (${accountId})`);
  }

  console.log(`\n📊 Noblus® — Coletando dados de ${PERIODS.length} períodos × ${LEVELS.length} níveis...`);

  const result = {
    meta: {
      collected_at: new Date().toISOString(),
      account_id: accountId,
    },
    periods: {},
  };

  // Parallel fetches — all 8 combinations at once
  const tasks = [];
  for (const days of PERIODS) {
    for (const level of LEVELS) {
      tasks.push(async () => {
        process.stdout.write(`   ⏳ ${days}d / ${level}...`);
        try {
          const data = await getInsights(accountId, META_ACCESS_TOKEN, days, level);
          if (!result.periods[days]) result.periods[days] = {};
          result.periods[days][level] = data.map(ins => ({
            ...ins,
            _metrics: calcMetrics(ins),
          }));
          console.log(` ${data.length} registros`);
        } catch (err) {
          console.log(` ⚠️  erro: ${err.message}`);
          if (!result.periods[days]) result.periods[days] = {};
          result.periods[days][level] = [];
        }
      });
    }
  }

  await Promise.all(tasks.map(t => t()));

  // Ensure output directory exists
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2));

  console.log(`\n✅ Dados salvos em: ${output}`);
}

main().catch(err => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
