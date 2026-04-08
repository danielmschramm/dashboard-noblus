#!/usr/bin/env node
// generate-dashboard.js — Noblus® Meta Ads Dashboard Generator
// Reads dashboard-data.json and generates a self-contained HTML dashboard
// Usage: node generate-dashboard.js [--input data.json] [--output www/index.html]

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {
    input: resolve(__dirname, 'dashboard-data.json'),
    output: resolve(process.cwd(), 'www', 'index.html'),
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) args.input = argv[++i];
    if (argv[i] === '--output' && argv[i + 1]) args.output = argv[++i];
  }
  return args;
}

function generateHTML(data) {
  const collectedAt = new Date(data.meta.collected_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Noblus Eyewear — Meta Ads Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f1f5f9;
    --surface: #ffffff;
    --sidebar-bg: #ffffff;
    --border: #e2e8f0;
    --primary: #6366f1;
    --primary-light: #eef2ff;
    --text: #0f172a;
    --text-muted: #64748b;
    --text-light: #94a3b8;
    --ok: #22c55e;
    --ok-bg: #f0fdf4;
    --warn: #f59e0b;
    --warn-bg: #fffbeb;
    --crit: #ef4444;
    --crit-bg: #fef2f2;
    --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04);
    --radius: 12px;
    --sidebar-w: 220px;
  }
  html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); }
  .layout { display: flex; height: 100vh; overflow: hidden; }

  /* SIDEBAR */
  .sidebar {
    width: var(--sidebar-w);
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow-y: auto;
  }
  .sidebar-logo {
    padding: 20px 16px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid var(--border);
  }
  .sidebar-logo .logo-icon {
    width: 32px; height: 32px;
    background: var(--primary);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 16px; font-weight: 700;
  }
  .sidebar-logo .logo-text { font-size: 13px; font-weight: 700; color: var(--text); line-height: 1.2; }
  .sidebar-logo .logo-sub { font-size: 11px; color: var(--text-muted); }
  .sidebar-section { padding: 12px 8px 4px; font-size: 10px; font-weight: 600; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.08em; }
  .sidebar-nav { padding: 4px 8px; }
  .nav-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 8px;
    font-size: 13px; font-weight: 500; color: var(--text-muted);
    cursor: pointer; transition: all 0.15s;
  }
  .nav-item:hover { background: var(--bg); color: var(--text); }
  .nav-item.active { background: var(--primary-light); color: var(--primary); font-weight: 600; }
  .nav-item .nav-icon { font-size: 15px; width: 20px; text-align: center; }
  .sidebar-footer {
    margin-top: auto;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-light);
  }

  /* MAIN */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  /* TOPBAR */
  .topbar {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .topbar-title { font-size: 16px; font-weight: 700; color: var(--text); flex: 1; }
  .topbar-subtitle { font-size: 12px; color: var(--text-muted); margin-top: 1px; }
  .filters { display: flex; align-items: center; gap: 8px; }
  .filter-group { display: flex; align-items: center; gap: 6px; }
  .filter-group label { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
  select.filter-select {
    padding: 6px 28px 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
    background: var(--bg) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 8px center;
    appearance: none;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  select.filter-select:focus { outline: none; border-color: var(--primary); }
  .btn-export {
    padding: 6px 14px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    transition: opacity 0.15s;
  }
  .btn-export:hover { opacity: 0.9; }

  /* CONTENT */
  .content { flex: 1; overflow-y: auto; padding: 20px 24px 32px; }

  /* KPI CARDS */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
    margin-bottom: 20px;
  }
  .kpi-card {
    background: var(--surface);
    border-radius: var(--radius);
    padding: 16px;
    box-shadow: var(--shadow);
    position: relative;
    overflow: hidden;
  }
  .kpi-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--status-color, var(--border));
    border-radius: var(--radius) var(--radius) 0 0;
  }
  .kpi-card.ok { --status-color: var(--ok); }
  .kpi-card.warn { --status-color: var(--warn); }
  .kpi-card.crit { --status-color: var(--crit); }
  .kpi-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .kpi-value { font-size: 26px; font-weight: 800; color: var(--text); line-height: 1; margin-bottom: 6px; }
  .kpi-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 99px;
    font-size: 11px; font-weight: 600;
  }
  .kpi-badge.ok { background: var(--ok-bg); color: #15803d; }
  .kpi-badge.warn { background: var(--warn-bg); color: #b45309; }
  .kpi-badge.crit { background: var(--crit-bg); color: #b91c1c; }
  .kpi-meta { font-size: 11px; color: var(--text-light); margin-top: 4px; }

  /* CHARTS GRID */
  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 20px;
  }
  .chart-card {
    background: var(--surface);
    border-radius: var(--radius);
    padding: 18px;
    box-shadow: var(--shadow);
    position: relative;
  }
  .chart-card.full { grid-column: 1 / -1; }
  .chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .chart-title { font-size: 13px; font-weight: 700; color: var(--text); }
  .chart-subtitle { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
  .btn-reset-zoom {
    padding: 3px 10px; border-radius: 6px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text-muted); font-size: 11px;
    cursor: pointer; transition: all 0.15s;
  }
  .btn-reset-zoom:hover { border-color: var(--primary); color: var(--primary); }
  .chart-wrap { position: relative; }

  /* FUNNEL */
  .funnel { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
  .funnel-row { display: flex; align-items: center; gap: 10px; }
  .funnel-label { font-size: 12px; color: var(--text-muted); width: 100px; text-align: right; flex-shrink: 0; }
  .funnel-bar-wrap { flex: 1; height: 32px; background: var(--bg); border-radius: 6px; overflow: hidden; position: relative; }
  .funnel-bar {
    height: 100%; border-radius: 6px;
    display: flex; align-items: center; padding: 0 10px;
    font-size: 12px; font-weight: 700; color: #fff;
    white-space: nowrap;
    transition: width 0.6s ease;
  }
  .funnel-pct { font-size: 11px; color: var(--text-light); width: 52px; flex-shrink: 0; text-align: right; }

  /* TABLE */
  .table-card {
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
    margin-bottom: 20px;
  }
  .table-header { padding: 14px 18px 10px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .table-title { font-size: 13px; font-weight: 700; color: var(--text); }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead tr { background: var(--bg); }
  th {
    padding: 10px 14px; text-align: left;
    font-size: 11px; font-weight: 600; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.05em;
    white-space: nowrap; cursor: pointer; user-select: none;
    border-bottom: 1px solid var(--border);
  }
  th:hover { color: var(--primary); }
  th .sort-icon { margin-left: 4px; opacity: 0.4; }
  th.sorted { color: var(--primary); }
  th.sorted .sort-icon { opacity: 1; }
  td { padding: 10px 14px; border-bottom: 1px solid var(--border); color: var(--text); white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--bg); }
  .badge {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600;
  }
  .badge.ok { background: var(--ok-bg); color: #15803d; }
  .badge.warn { background: var(--warn-bg); color: #b45309; }
  .badge.crit { background: var(--crit-bg); color: #b91c1c; }

  /* EMPTY STATE */
  .empty { text-align: center; padding: 48px 24px; color: var(--text-muted); }
  .empty h3 { font-size: 16px; margin-bottom: 8px; color: var(--text); }

  /* PRINT */
  @media print {
    .sidebar, .topbar .filters { display: none; }
    .layout { display: block; }
    .content { overflow: visible; }
    .chart-card, .kpi-card, .table-card { break-inside: avoid; }
  }

  @media (max-width: 900px) {
    .sidebar { display: none; }
    .charts-grid { grid-template-columns: 1fr; }
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>
<div class="layout">

  <!-- SIDEBAR -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon">N</div>
      <div>
        <div class="logo-text">Noblus Eyewear</div>
        <div class="logo-sub">Meta Ads Dashboard</div>
      </div>
    </div>
    <div class="sidebar-nav" style="margin-top:8px">
      <div class="sidebar-section">Geral</div>
      <div class="nav-item active"><span class="nav-icon">📊</span> Dashboard</div>
      <div class="nav-item"><span class="nav-icon">📣</span> Campanhas</div>
      <div class="nav-item"><span class="nav-icon">🎯</span> Conjuntos</div>
      <div class="nav-item"><span class="nav-icon">🎨</span> Criativos</div>
    </div>
    <div class="sidebar-nav">
      <div class="sidebar-section">Análise</div>
      <div class="nav-item"><span class="nav-icon">📈</span> Tendências</div>
      <div class="nav-item"><span class="nav-icon">🔁</span> Retargeting</div>
    </div>
    <div class="sidebar-footer">
      Atualizado em<br><span id="footer-date" style="color:var(--text-muted)"></span>
    </div>
  </aside>

  <!-- MAIN -->
  <div class="main">

    <!-- TOPBAR -->
    <div class="topbar">
      <div>
        <div class="topbar-title">Dashboard</div>
        <div class="topbar-subtitle" id="topbar-subtitle">Visão geral da conta</div>
      </div>
      <div class="filters">
        <div class="filter-group">
          <label>Período</label>
          <select class="filter-select" id="sel-period">
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="180" selected>180 dias</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Campanha</label>
          <select class="filter-select" id="sel-campaign">
            <option value="all">Todas</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Conjunto</label>
          <select class="filter-select" id="sel-adset">
            <option value="all">Todos</option>
          </select>
        </div>
        <button class="btn-export" onclick="window.print()">
          <span>⬇</span> Exportar
        </button>
      </div>
    </div>

    <!-- CONTENT -->
    <div class="content">

      <!-- KPI CARDS -->
      <div class="kpi-grid" id="kpi-grid"></div>

      <!-- CHARTS -->
      <div class="charts-grid" id="charts-grid">
        <div class="chart-card">
          <div class="chart-header">
            <div>
              <div class="chart-title">ROAS por Campanha</div>
              <div class="chart-subtitle">Scroll para zoom · arraste para navegar</div>
            </div>
            <button class="btn-reset-zoom" onclick="resetZoom('chartRoas')">↺ Reset zoom</button>
          </div>
          <div class="chart-wrap"><canvas id="chartRoas" height="200"></canvas></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div>
              <div class="chart-title">Funil de Conversão</div>
              <div class="chart-subtitle">Impressões → Compras</div>
            </div>
          </div>
          <div id="funnel-wrap" class="funnel"></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div>
              <div class="chart-title">Distribuição de Investimento</div>
              <div class="chart-subtitle">Por campanha</div>
            </div>
          </div>
          <div class="chart-wrap" style="max-width:340px;margin:0 auto"><canvas id="chartSpend" height="200"></canvas></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div>
              <div class="chart-title">Hook Rate vs Hold Rate</div>
              <div class="chart-subtitle">Qualidade de criativo · meta: Hook ≥ 30% · Hold ≥ 20%</div>
            </div>
            <button class="btn-reset-zoom" onclick="resetZoom('chartHook')">↺ Reset zoom</button>
          </div>
          <div class="chart-wrap"><canvas id="chartHook" height="200"></canvas></div>
        </div>
      </div>

      <!-- TABLE -->
      <div class="table-card">
        <div class="table-header">
          <div class="table-title" id="table-title">Métricas Detalhadas</div>
        </div>
        <div class="table-wrap">
          <table id="metrics-table">
            <thead>
              <tr>
                <th onclick="sortTable(0)" data-col="0">Nome <span class="sort-icon">↕</span></th>
                <th onclick="sortTable(1)" data-col="1">Investimento <span class="sort-icon">↕</span></th>
                <th onclick="sortTable(2)" data-col="2">ROAS <span class="sort-icon">↕</span></th>
                <th onclick="sortTable(3)" data-col="3">Compras <span class="sort-icon">↕</span></th>
                <th onclick="sortTable(4)" data-col="4">Carrinhos <span class="sort-icon">↕</span></th>
                <th onclick="sortTable(5)" data-col="5">CTR <span class="sort-icon">↕</span></th>
                <th onclick="sortTable(6)" data-col="6">Hook Rate <span class="sort-icon">↕</span></th>
                <th onclick="sortTable(7)" data-col="7">Hold Rate <span class="sort-icon">↕</span></th>
                <th onclick="sortTable(8)" data-col="8">CPM <span class="sort-icon">↕</span></th>
                <th onclick="sortTable(9)" data-col="9">Freq. <span class="sort-icon">↕</span></th>
              </tr>
            </thead>
            <tbody id="table-body"></tbody>
          </table>
        </div>
      </div>

    </div><!-- /content -->
  </div><!-- /main -->
</div><!-- /layout -->

<script>
// ─── DATA ──────────────────────────────────────────────────────────────────
const DASHBOARD_DATA = ${JSON.stringify(data)};

// ─── BENCHMARKS ────────────────────────────────────────────────────────────
function statusRoas(v)  { return v >= 4 ? 'ok' : v >= 2.5 ? 'warn' : 'crit'; }
function statusHook(v)  { return v >= 30 ? 'ok' : v >= 20 ? 'warn' : 'crit'; }
function statusHold(v)  { return v >= 20 ? 'ok' : v >= 10 ? 'warn' : 'crit'; }
function statusCtr(v)   { return v >= 1.5 ? 'ok' : v >= 1 ? 'warn' : 'crit'; }
function statusFreq(v)  { return v <= 3 ? 'ok' : v <= 4.5 ? 'warn' : 'crit'; }
function statusLabel(s) { return { ok: '✓ Ótimo', warn: '⚠ Atenção', crit: '✕ Crítico' }[s]; }

// ─── FORMAT ────────────────────────────────────────────────────────────────
function brl(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
}
function pct(v) { return Number(v).toFixed(2).replace('.', ',') + '%'; }
function num(v) { return Number(v).toLocaleString('pt-BR'); }

// ─── CHART INSTANCES ───────────────────────────────────────────────────────
const charts = {};
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
function resetZoom(id) { if (charts[id]) charts[id].resetZoom(); }

// ─── AGGREGATE ─────────────────────────────────────────────────────────────
function aggregate(rows) {
  if (!rows.length) return null;
  let spend = 0, impressions = 0, reach = 0, purchases = 0, addToCart = 0, clicks = 0;
  let roasNum = 0, roasDen = 0;
  for (const r of rows) {
    const m = r._metrics;
    spend += m.spend;
    impressions += m.impressions;
    reach += m.reach;
    purchases += m.purchases;
    addToCart += m.addToCart;
    clicks += m.clicks;
    if (m.roas > 0) { roasNum += m.roas * m.spend; roasDen += m.spend; }
  }
  const roas = roasDen > 0 ? roasNum / roasDen : 0;
  const views3s = rows.reduce((s, r) => s + (findAction(r.actions, 'video_view') || 0), 0);
  const views50 = rows.reduce((s, r) => s + (findAction(r.video_p50_watched_actions, 'video_view') || 0), 0);
  const viewsTp = rows.reduce((s, r) => s + (findAction(r.video_thruplay_watched_actions, 'video_view') || 0), 0);
  const hookRate = impressions > 0 ? (views3s / impressions) * 100 : 0;
  const holdRate = impressions > 0 ? ((views50 || viewsTp) / impressions) * 100 : 0;
  const ctrLink = clicks > 0 && impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cac = purchases > 0 ? spend / purchases : 0;
  const cpaCart = addToCart > 0 ? spend / addToCart : 0;
  const frequency = rows.reduce((s, r) => s + r._metrics.frequency * r._metrics.impressions, 0) / (impressions || 1);
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  return { spend, impressions, reach, purchases, addToCart, clicks, roas, hookRate, holdRate, ctrLink, cac, cpaCart, frequency, cpm };
}

function findAction(arr, type) {
  if (!Array.isArray(arr)) return 0;
  const a = arr.find(x => x.action_type === type);
  return a ? parseFloat(a.value) : 0;
}

// ─── STATE ─────────────────────────────────────────────────────────────────
let state = { period: 180, campaign: 'all', adset: 'all' };

function getPeriodData() {
  return DASHBOARD_DATA.periods[state.period] || { campaign: [], adset: [] };
}

function getActiveCampaigns() {
  return getPeriodData().campaign || [];
}

function getActiveAdsets() {
  const adsets = getPeriodData().adset || [];
  if (state.campaign === 'all') return adsets;
  return adsets.filter(a => a.campaign_name === state.campaign);
}

function getTableRows() {
  if (state.adset !== 'all') {
    return getActiveAdsets().filter(a => a.adset_name === state.adset);
  }
  if (state.campaign !== 'all') {
    return getActiveAdsets();
  }
  return getActiveCampaigns();
}

function getAggregateMetrics() {
  return aggregate(getTableRows());
}

function getRowLabel(row) {
  if (state.campaign !== 'all') return row.adset_name || row.campaign_name || '—';
  return row.campaign_name || row.adset_name || '—';
}

// ─── KPI CARDS ─────────────────────────────────────────────────────────────
function renderKpis() {
  const m = getAggregateMetrics();
  if (!m) {
    document.getElementById('kpi-grid').innerHTML = '<div class="empty"><h3>Sem dados</h3><p>Nenhum dado disponível para este filtro.</p></div>';
    return;
  }
  const cards = [
    { label: 'ROAS', value: m.roas > 0 ? m.roas.toFixed(2) + 'x' : '—', status: statusRoas(m.roas), badge: statusLabel(statusRoas(m.roas)), meta: 'Meta: ≥ 4x' },
    { label: 'Investimento', value: brl(m.spend), status: 'ok', badge: null, meta: num(m.impressions) + ' impressões' },
    { label: 'Compras', value: num(m.purchases), status: m.purchases > 0 ? 'ok' : 'crit', badge: m.cac > 0 ? 'CAC ' + brl(m.cac) : null, meta: m.addToCart + ' carrinhos' },
    { label: 'CTR Link', value: pct(m.ctrLink), status: statusCtr(m.ctrLink), badge: statusLabel(statusCtr(m.ctrLink)), meta: 'Meta: ≥ 1,5%' },
    { label: 'Hook Rate', value: pct(m.hookRate), status: statusHook(m.hookRate), badge: statusLabel(statusHook(m.hookRate)), meta: 'Meta: ≥ 30%' },
    { label: 'Hold Rate', value: pct(m.holdRate), status: statusHold(m.holdRate), badge: statusLabel(statusHold(m.holdRate)), meta: 'Meta: ≥ 20%' },
  ];
  document.getElementById('kpi-grid').innerHTML = cards.map(c => \`
    <div class="kpi-card \${c.status}">
      <div class="kpi-label">\${c.label}</div>
      <div class="kpi-value">\${c.value}</div>
      \${c.badge ? \`<span class="kpi-badge \${c.status}">\${c.badge}</span>\` : ''}
      <div class="kpi-meta">\${c.meta}</div>
    </div>
  \`).join('');
}

// ─── CHARTS ────────────────────────────────────────────────────────────────
const COLORS = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#818cf8'];
const C_OK   = '#22c55e';
const C_WARN = '#f59e0b';
const C_CRIT = '#ef4444';

function metricColor(fn, v) {
  const s = fn(v);
  return s === 'ok' ? C_OK : s === 'warn' ? C_WARN : C_CRIT;
}

const zoomPlugin = {
  zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
  pan: { enabled: true, mode: 'x' },
};

function renderCharts() {
  const rows = getTableRows();
  if (!rows.length) return;

  const labels = rows.map(r => getRowLabel(r));
  const metrics = rows.map(r => r._metrics);

  // ROAS Chart (horizontal bar)
  destroyChart('chartRoas');
  const ctxRoas = document.getElementById('chartRoas').getContext('2d');
  charts['chartRoas'] = new Chart(ctxRoas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'ROAS',
        data: metrics.map(m => m.roas),
        backgroundColor: metrics.map(m => metricColor(statusRoas, m.roas)),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => \`ROAS: \${ctx.raw.toFixed(2)}x (meta: 4x)\`
          }
        },
        zoom: zoomPlugin,
        annotation: {
          annotations: {
            goal: {
              type: 'line',
              xMin: 4, xMax: 4,
              borderColor: '#6366f1',
              borderWidth: 1.5,
              borderDash: [4, 4],
              label: { display: true, content: 'Meta 4x', position: 'start', font: { size: 10 } }
            }
          }
        }
      },
      scales: {
        x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });

  // Funnel
  const agg = aggregate(rows);
  if (agg) {
    const steps = [
      { label: 'Impressões', value: agg.impressions, color: '#6366f1' },
      { label: 'Cliques', value: agg.clicks, color: '#8b5cf6' },
      { label: 'Carrinhos', value: agg.addToCart, color: '#f59e0b' },
      { label: 'Compras', value: agg.purchases, color: '#22c55e' },
    ];
    const max = steps[0].value || 1;
    document.getElementById('funnel-wrap').innerHTML = steps.map((s, i) => {
      const w = Math.max((s.value / max) * 100, s.value > 0 ? 5 : 0);
      const pctVsPrev = i === 0 ? '' : steps[i-1].value > 0 ? pct((s.value / steps[i-1].value) * 100) : '—';
      return \`
        <div class="funnel-row">
          <div class="funnel-label">\${s.label}</div>
          <div class="funnel-bar-wrap">
            <div class="funnel-bar" style="width:\${w}%;background:\${s.color}">
              \${num(s.value)}
            </div>
          </div>
          <div class="funnel-pct">\${pctVsPrev}</div>
        </div>
      \`;
    }).join('');
  }

  // Spend Doughnut
  destroyChart('chartSpend');
  const ctxSpend = document.getElementById('chartSpend').getContext('2d');
  charts['chartSpend'] = new Chart(ctxSpend, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: metrics.map(m => m.spend),
        backgroundColor: COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => \` \${ctx.label}: \${brl(ctx.raw)} (\${((ctx.raw/metrics.reduce((s,m)=>s+m.spend,0))*100).toFixed(1)}%)\`
          }
        }
      }
    }
  });

  // Hook vs Hold grouped bar
  destroyChart('chartHook');
  const ctxHook = document.getElementById('chartHook').getContext('2d');
  charts['chartHook'] = new Chart(ctxHook, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Hook Rate (3s)',
          data: metrics.map(m => m.hookRate),
          backgroundColor: metrics.map(m => metricColor(statusHook, m.hookRate) + 'cc'),
          borderRadius: 4,
        },
        {
          label: 'Hold Rate (50%)',
          data: metrics.map(m => m.holdRate),
          backgroundColor: metrics.map(m => metricColor(statusHold, m.holdRate) + '88'),
          borderRadius: 4,
        },
      ]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => \` \${ctx.dataset.label}: \${ctx.raw.toFixed(2)}%\`
          }
        },
        zoom: zoomPlugin,
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: { font: { size: 11 }, callback: v => v + '%' },
          max: Math.max(35, ...metrics.map(m => Math.max(m.hookRate, m.holdRate))) + 5,
        }
      }
    }
  });
}

// ─── TABLE ─────────────────────────────────────────────────────────────────
let sortCol = -1, sortAsc = true;

function renderTable() {
  const rows = getTableRows();
  const isAdsetView = state.campaign !== 'all';
  document.getElementById('table-title').textContent = isAdsetView
    ? 'Conjuntos de Anúncios — ' + state.campaign
    : 'Campanhas';

  if (!rows.length) {
    document.getElementById('table-body').innerHTML = '<tr><td colspan="10" class="empty">Sem dados para este filtro.</td></tr>';
    return;
  }

  document.getElementById('table-body').innerHTML = rows.map(r => {
    const m = r._metrics;
    const name = getRowLabel(r);
    return \`<tr>
      <td style="font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis" title="\${name}">\${name}</td>
      <td>\${brl(m.spend)}</td>
      <td><span class="badge \${statusRoas(m.roas)}">\${m.roas > 0 ? m.roas.toFixed(2) + 'x' : '—'}</span></td>
      <td>\${m.purchases || '—'}</td>
      <td>\${m.addToCart || '—'}</td>
      <td><span class="badge \${statusCtr(m.ctrLink)}">\${pct(m.ctrLink)}</span></td>
      <td><span class="badge \${statusHook(m.hookRate)}">\${pct(m.hookRate)}</span></td>
      <td><span class="badge \${statusHold(m.holdRate)}">\${pct(m.holdRate)}</span></td>
      <td>\${brl(m.cpm)}</td>
      <td><span class="badge \${statusFreq(m.frequency)}">\${m.frequency.toFixed(2)}x</span></td>
    </tr>\`;
  }).join('');

  // Update sort icon
  document.querySelectorAll('th').forEach((th, i) => {
    th.classList.toggle('sorted', i === sortCol);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = i === sortCol ? (sortAsc ? '↑' : '↓') : '↕';
  });
}

function sortTable(col) {
  if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = false; }
  // Note: sorting would need to re-sort the getTableRows() result
  // For simplicity we sort the DOM rows
  const tbody = document.getElementById('table-body');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  rows.sort((a, b) => {
    const valA = a.cells[col]?.textContent?.trim() || '';
    const valB = b.cells[col]?.textContent?.trim() || '';
    const numA = parseFloat(valA.replace(/[^0-9.,]/g, '').replace(',', '.'));
    const numB = parseFloat(valB.replace(/[^0-9.,]/g, '').replace(',', '.'));
    const cmp = isNaN(numA) || isNaN(numB) ? valA.localeCompare(valB, 'pt-BR') : numA - numB;
    return sortAsc ? cmp : -cmp;
  });
  rows.forEach(r => tbody.appendChild(r));
  document.querySelectorAll('th').forEach((th, i) => {
    th.classList.toggle('sorted', i === sortCol);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = i === sortCol ? (sortAsc ? '↑' : '↓') : '↕';
  });
}

// ─── FILTER POPULATION ─────────────────────────────────────────────────────
function populateCampaigns() {
  const campaigns = getActiveCampaigns();
  const sel = document.getElementById('sel-campaign');
  const prev = sel.value;
  sel.innerHTML = '<option value="all">Todas</option>' +
    campaigns.map(c => {
      const name = c.campaign_name || '—';
      return \`<option value="\${name}">\${name.length > 30 ? name.slice(0,28)+'…' : name}</option>\`;
    }).join('');
  if (campaigns.find(c => c.campaign_name === prev)) sel.value = prev;
  else sel.value = 'all';
}

function populateAdsets() {
  const adsets = getActiveAdsets();
  const sel = document.getElementById('sel-adset');
  const prev = sel.value;
  const unique = [...new Set(adsets.map(a => a.adset_name).filter(Boolean))];
  sel.innerHTML = '<option value="all">Todos</option>' +
    unique.map(n => \`<option value="\${n}">\${n.length > 28 ? n.slice(0,26)+'…' : n}</option>\`).join('');
  if (unique.includes(prev)) sel.value = prev;
  else sel.value = 'all';
}

// ─── FULL RENDER ───────────────────────────────────────────────────────────
function render() {
  const subtitle = state.campaign !== 'all'
    ? (state.adset !== 'all' ? state.adset : state.campaign)
    : 'Visão geral da conta';
  document.getElementById('topbar-subtitle').textContent = subtitle;

  renderKpis();
  renderCharts();
  renderTable();
}

// ─── EVENTS ────────────────────────────────────────────────────────────────
document.getElementById('sel-period').addEventListener('change', e => {
  state.period = parseInt(e.target.value);
  state.campaign = 'all';
  state.adset = 'all';
  populateCampaigns();
  populateAdsets();
  render();
});

document.getElementById('sel-campaign').addEventListener('change', e => {
  state.campaign = e.target.value;
  state.adset = 'all';
  populateAdsets();
  render();
});

document.getElementById('sel-adset').addEventListener('change', e => {
  state.adset = e.target.value;
  render();
});

// ─── INIT ──────────────────────────────────────────────────────────────────
document.getElementById('footer-date').textContent =
  new Date(DASHBOARD_DATA.meta.collected_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

state.period = 180;
document.getElementById('sel-period').value = '180';

populateCampaigns();
populateAdsets();
render();
</script>
</body>
</html>`;
}

async function main() {
  const { input, output } = parseArgs(process.argv);

  console.log(`📖 Lendo dados de: ${input}`);
  const raw = readFileSync(input, 'utf8');
  const data = JSON.parse(raw);

  const html = generateHTML(data);

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html, 'utf8');

  const kb = Math.round(html.length / 1024);
  console.log(`✅ Dashboard gerado: ${output} (${kb} KB)`);
  console.log(`   Períodos: ${Object.keys(data.periods).join(', ')} dias`);
}

main().catch(err => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
