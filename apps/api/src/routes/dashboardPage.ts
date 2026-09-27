export const dashboardPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TRAWL · Metrics</title>
<style>
:root{font:14px system-ui,-apple-system,sans-serif;color:#e8eef5;background:#0e151d;color-scheme:dark}
*{box-sizing:border-box}body{max-width:1320px;margin:auto;padding:30px 28px 70px}
h1,h2,p{margin-top:0}h1{font-size:29px;letter-spacing:-.04em;margin-bottom:3px}h2{font-size:15px;letter-spacing:-.01em;margin-bottom:5px}
p,small{color:#9aaebe}.muted{color:#9aaebe}.eyebrow{color:#73bcff;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:26px}.brand{display:flex;align-items:center;gap:14px}.mark{display:grid;place-items:center;width:43px;height:43px;border-radius:11px;background:#216ee1;color:white;font-size:24px;font-weight:900;letter-spacing:-.09em}
.status{display:flex;align-items:center;gap:8px;color:#b6c5d2;font-size:12px;padding-top:14px}.status-dot{width:7px;height:7px;border-radius:50%;background:#687b8e}.status.live .status-dot{background:#31c79a;box-shadow:0 0 0 3px #31c79a22}.status.paused .status-dot{background:#eab65c}
button,input{font:inherit}button{cursor:pointer;border:1px solid #38506a;background:#1b2a3a;color:#dbe8f3;border-radius:7px;padding:8px 11px}button:hover{background:#263b51}button:focus-visible,input:focus-visible{outline:2px solid #76baff;outline-offset:2px}.primary{background:#216ee1;border-color:#216ee1;color:white}.primary:hover{background:#2d7df0}
#login{display:flex;gap:8px;max-width:510px;margin:35px 0 24px}#login input{flex:1;min-width:0}input{border:1px solid #38506a;border-radius:7px;background:#152230;color:#e8eef5;padding:9px 11px}input::placeholder{color:#7f94a7}#error{color:#ffb2a6;min-height:18px}
.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:17px;flex-wrap:wrap}.toolbar-group{display:flex;align-items:center;gap:7px}.toolbar button{font-size:12px}.range[aria-pressed="true"]{background:#315879;border-color:#5696ca;color:white}.toolbar-label{font-size:12px;color:#9aaebe;margin-right:6px}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-bottom:15px}.kpi{padding:17px 18px;border:1px solid #2d4054;border-radius:10px;background:#172431}.kpi strong{display:block;font-size:31px;letter-spacing:-.045em;line-height:1.1;font-variant-numeric:tabular-nums}.kpi span{display:block;color:#a8b9c8;font-size:12px;margin-top:7px}.kpi:nth-child(2) strong{color:#5ddab5}.kpi:nth-child(3) strong{color:#ffb583}
.layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(290px,1fr);gap:15px}.panel{border:1px solid #2d4054;background:#172431;border-radius:10px;padding:20px;min-width:0}.panel p{font-size:12px;margin-bottom:12px}.wide{grid-column:1/-1}.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}.legend{display:flex;align-items:center;gap:13px;font-size:11px;color:#aebdca}.key{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px}.good{background:#4dcba6}.bad{background:#f5a363}
#trend{width:100%;height:auto;min-height:190px;display:block}.meter-list{display:grid;gap:13px;margin-top:17px}.meter-row{display:grid;grid-template-columns:76px minmax(0,1fr) 78px;align-items:center;gap:11px;font-size:12px}.meter-row .name{color:#cedae5}.meter-row .value{text-align:right;color:#9eb0bf;font-variant-numeric:tabular-nums}.track{height:9px;border-radius:999px;background:#263b4c;overflow:hidden}.activity{height:100%;background:#4c6171;border-radius:999px;overflow:hidden}.win-fill,.category-fill,.source-fill{height:100%;border-radius:999px;background:#4dcba6}.category-fill{background:#f3a15f}.source-fill{background:#70acfa}
.table-scroll{overflow:auto;max-height:410px}table{width:100%;border-collapse:collapse;font-size:12px;text-align:left}th{position:sticky;top:0;background:#172431;color:#8fa5b8;font-weight:600;white-space:nowrap}th,td{padding:10px 9px;border-bottom:1px solid #2a3b4c}td{color:#cbd7e1}td:first-child,th:first-child{padding-left:0}td:last-child,th:last-child{padding-right:0}td.number{font-variant-numeric:tabular-nums;text-align:right}th.number{text-align:right}.failure-search{width:min(310px,100%);font-size:12px}.footnote{font-size:11px;color:#7f95a8;margin:18px 1px}
[hidden]{display:none!important}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:850px){body{padding:20px 15px 55px}.layout{grid-template-columns:1fr}.wide{grid-column:1}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}header{align-items:center}.status{padding:0}}
@media(max-width:450px){.kpis{gap:8px}.kpi{padding:14px}.kpi strong{font-size:25px}.mark{width:36px;height:36px}h1{font-size:23px}.panel{padding:15px}.meter-row{grid-template-columns:66px minmax(0,1fr) 68px;gap:7px}}
</style>
</head>
<body>
<header><div class="brand"><div class="mark" aria-hidden="true">T</div><div><div class="eyebrow">Local observability</div><h1>TRAWL metrics</h1><small>Scrape activity on this instance</small></div></div><div id="status" class="status"><span class="status-dot"></span><span id="status-text">Locked</span></div></header>
<form id="login"><input id="token" type="password" autocomplete="off" placeholder="Dashboard token" aria-label="Dashboard token" required><button class="primary">Open dashboard</button></form>
<p id="error" role="alert"></p>
<main id="content" hidden>
<div class="toolbar"><div class="toolbar-group"><span class="toolbar-label">Activity</span><button class="range" data-minutes="15" aria-pressed="false">15 min</button><button class="range" data-minutes="60" aria-pressed="true">60 min</button></div><div class="toolbar-group"><span id="updated" class="toolbar-label">Waiting for data</span><button id="refresh" type="button">Refresh</button><button id="pause" type="button" aria-pressed="false">Pause live</button><button id="export" type="button">Export JSON</button></div></div>
<div class="kpis"><div class="kpi"><strong id="requests">0</strong><span>Requests</span></div><div class="kpi"><strong id="success-rate">0%</strong><span>Success rate</span></div><div class="kpi"><strong id="failures">0</strong><span>Failures</span></div><div class="kpi"><strong id="average">0 ms</strong><span>Average duration</span></div></div>
<div class="layout">
<section class="panel wide"><div class="panel-head"><div><h2>Request activity</h2><p>Completed requests per minute</p></div><div class="legend"><span><i class="key good"></i>Success</span><span><i class="key bad"></i>Failure</span></div></div><svg id="trend" role="img" aria-label="Successful and failed requests by minute" viewBox="0 0 720 220"></svg><p id="trend-summary" class="sr-only"></p></section>
<section class="panel"><h2>Tier outcomes</h2><p>Attempts and successful final responses</p><div id="tiers" class="meter-list"></div></section>
<section class="panel"><h2>Failure causes</h2><p>Best-effort classification since process start</p><div id="categories" class="meter-list"></div></section>
<section class="panel"><h2>Domains with failures</h2><p>Highest failure counts among retained hostnames</p><div class="table-scroll"><table><thead><tr><th>Domain</th><th class="number">Requests</th><th class="number">Failed</th><th class="number">Rate</th></tr></thead><tbody id="domains"></tbody></table></div></section>
<section class="panel"><h2>Request sources</h2><p>Completed operations by entry point</p><div id="sources" class="meter-list"></div></section>
<section class="panel wide"><div class="panel-head"><div><h2>Recent failures</h2><p>Last 50 failures, newest first</p></div><input id="failure-search" class="failure-search" type="search" placeholder="Filter domain, cause or source" aria-label="Filter recent failures"></div><div class="table-scroll"><table><thead><tr><th>Time</th><th>Domain</th><th>Source</th><th>Tier</th><th>Status</th><th>HTTP</th><th>Cause</th><th>Severity</th></tr></thead><tbody id="recent"></tbody></table></div></section>
</div><p class="footnote">Hostnames only · no remote telemetry · data resets when this process restarts</p>
</main>
<script>
let token = '';
let timer;
let paused = false;
let loading = false;
let minutes = window.matchMedia('(max-width: 600px)').matches ? 15 : 60;
let currentData;
const byId = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const number = value => new Intl.NumberFormat().format(value);

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = String(value);
  return node;
}

function drawRows(id, items, emptyMessage) {
  const body = byId(id);
  body.replaceChildren();
  if (!items.length) {
    const row = element('tr');
    const cell = element('td', 'muted', emptyMessage);
    cell.colSpan = id === 'recent' ? 8 : 4;
    row.append(cell);
    body.append(row);
    return;
  }
  for (const item of items) {
    const row = element('tr');
    for (let i = 0; i < item.length; i++) {
      const cell = element('td', i > 0 && id === 'domains' ? 'number' : '', item[i]);
      row.append(cell);
    }
    body.append(row);
  }
}

function svgNode(tag, attrs) {
  const node = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

function drawTrend(data) {
  const points = data.lastHour.slice(-minutes);
  const svg = byId('trend');
  svg.replaceChildren();
  const max = Math.max(1, ...points.map(point => point.requests));
  const compact = window.matchMedia('(max-width: 600px)').matches;
  const width = compact ? 360 : 720;
  svg.setAttribute('viewBox', '0 0 ' + width + ' 220');
  const plotLeft = compact ? 32 : 44;
  const plotBottom = 182;
  const plotHeight = 150;
  const plotWidth = width - plotLeft - 26;
  const step = plotWidth / points.length;
  const barWidth = Math.max(2, step - (minutes === 60 ? 3 : 7));
  const tickInterval = compact ? (minutes === 60 ? 15 : 5) : (minutes === 60 ? 10 : 3);
  const lines = Math.min(3, max);
  for (let i = 0; i <= lines; i++) {
    const y = plotBottom - i * plotHeight / lines;
    svg.append(svgNode('line', { x1: plotLeft, y1: y, x2: width - 9, y2: y, stroke: '#344759', 'stroke-width': 1 }));
    const label = svgNode('text', { x: plotLeft - 8, y: y + 4, fill: '#8fa5b8', 'font-size': 11, 'text-anchor': 'end' });
    label.textContent = String(Math.round(max * i / lines));
    svg.append(label);
  }
  points.forEach((point, index) => {
    const x = plotLeft + index * step + (step - barWidth) / 2;
    const success = point.requests - point.failures;
    const successHeight = success / max * plotHeight;
    const failureHeight = point.failures / max * plotHeight;
    const group = svgNode('g', {});
    const title = svgNode('title', {});
    title.textContent = new Date(point.minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ': ' + success + ' succeeded, ' + point.failures + ' failed';
    group.append(title);
    if (successHeight) group.append(svgNode('rect', { x, y: plotBottom - successHeight, width: barWidth, height: successHeight, rx: 2, fill: '#4dcba6' }));
    if (failureHeight) group.append(svgNode('rect', { x, y: plotBottom - successHeight - failureHeight, width: barWidth, height: failureHeight, rx: 2, fill: '#f5a363' }));
    svg.append(group);
    if (index % tickInterval === 0 || index === points.length - 1) {
      const tick = svgNode('text', { x: x + barWidth / 2, y: 209, fill: '#8fa5b8', 'font-size': 11, 'text-anchor': 'middle' });
      tick.textContent = new Date(point.minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      svg.append(tick);
    }
  });
  const total = points.reduce((sum, point) => sum + point.requests, 0);
  const failed = points.reduce((sum, point) => sum + point.failures, 0);
  byId('trend-summary').textContent = total + ' requests in the last ' + minutes + ' minutes; ' + failed + ' failed.';
}

function meter(name, value, max, annotation, kind) {
  const row = element('div', 'meter-row');
  row.append(element('span', 'name', name));
  const track = element('div', 'track');
  const activity = element('div', 'activity');
  activity.style.width = (max ? value / max * 100 : 0) + '%';
  if (kind === 'category') activity.className = 'category-fill';
  if (kind === 'source') activity.className = 'source-fill';
  track.append(activity);
  row.append(track, element('span', 'value', annotation));
  return row;
}

function drawMeters(data) {
  const tierRoot = byId('tiers');
  tierRoot.replaceChildren();
  const tiers = Object.entries(data.byTier);
  const maxAttempts = Math.max(1, ...tiers.map(([, value]) => value.attempts));
  for (const [tier, value] of tiers) {
    const row = meter('Tier ' + tier, value.attempts, maxAttempts, value.successes + ' / ' + value.attempts);
    const activity = row.querySelector('.activity');
    const wins = element('div', 'win-fill');
    wins.style.width = (value.attempts ? value.successes / value.attempts * 100 : 0) + '%';
    activity.append(wins);
    tierRoot.append(row);
  }
  const causeRoot = byId('categories');
  causeRoot.replaceChildren();
  const causes = Object.entries(data.byFailure);
  const maxCause = Math.max(1, ...causes.map(([, count]) => count));
  for (const [cause, count] of causes) causeRoot.append(meter(cause, count, maxCause, number(count), 'category'));
  const sourceRoot = byId('sources');
  sourceRoot.replaceChildren();
  const sources = Object.entries(data.bySource);
  const maxSource = Math.max(1, ...sources.map(([, count]) => count));
  const sourceNames = { native: 'Native API', flaresolverr: '/v1', mcp: 'MCP', proxy: 'Proxy' };
  for (const [source, count] of sources) sourceRoot.append(meter(sourceNames[source] ?? source, count, maxSource, number(count), 'source'));
}

function drawFailures() {
  if (!currentData) return;
  const query = byId('failure-search').value.trim().toLowerCase();
  const entries = currentData.recentFailures.filter(item =>
    !query || [item.domain, item.source, item.category, item.severity].some(value => value.includes(query))
  );
  drawRows('recent', entries.map(item => [
    new Date(item.at).toLocaleTimeString(), item.domain, item.source,
    item.tier ?? '—', item.tierStatus ?? '—', item.statusCode ?? '—', item.category, item.severity
  ]), query ? 'No matching failures' : 'No failures recorded');
}

function render(data) {
  currentData = data;
  byId('requests').textContent = number(data.requests);
  byId('success-rate').textContent = (data.requests ? Math.round(data.successes / data.requests * 100) : 0) + '%';
  byId('failures').textContent = number(data.failures);
  byId('average').textContent = number(data.averageMs) + ' ms';
  drawTrend(data);
  drawMeters(data);
  drawRows('domains', data.domains.filter(item => item.failures).map(item => [
    item.domain, number(item.requests), number(item.failures), Math.round(item.failures / item.requests * 100) + '%'
  ]), 'No failing domains');
  drawFailures();
  byId('updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
}

function setStatus(state, label) {
  byId('status').className = 'status ' + state;
  byId('status-text').textContent = label;
}

async function refresh() {
  if (loading || !token) return;
  loading = true;
  try {
    const response = await fetch('/dashboard/metrics', {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store'
    });
    if (!response.ok) throw Error(response.status === 401 ? 'Invalid token' : 'Metrics unavailable');
    render(await response.json());
    byId('error').textContent = '';
    byId('content').hidden = false;
    byId('login').hidden = true;
    setStatus(paused ? 'paused' : 'live', paused ? 'Paused' : 'Live · 10 s');
  } catch (error) {
    byId('error').textContent = error.message;
    setStatus('', 'Connection issue');
    if (error.message === 'Invalid token') {
      token = '';
      byId('content').hidden = true;
      byId('login').hidden = false;
    }
  } finally {
    loading = false;
  }
}

byId('login').addEventListener('submit', event => {
  event.preventDefault();
  token = byId('token').value;
  byId('token').value = '';
  refresh();
  if (!timer) timer = setInterval(() => { if (!paused) refresh(); }, 10000);
});
for (const button of document.querySelectorAll('.range')) button.addEventListener('click', () => {
  minutes = Number(button.dataset.minutes);
  for (const option of document.querySelectorAll('.range')) option.setAttribute('aria-pressed', String(option === button));
  if (currentData) drawTrend(currentData);
});
byId('refresh').addEventListener('click', refresh);
byId('pause').addEventListener('click', event => {
  paused = !paused;
  event.currentTarget.textContent = paused ? 'Resume live' : 'Pause live';
  event.currentTarget.setAttribute('aria-pressed', String(paused));
  setStatus(paused ? 'paused' : 'live', paused ? 'Paused' : 'Live · 10 s');
  if (!paused) refresh();
});
byId('failure-search').addEventListener('input', drawFailures);
window.addEventListener('resize', () => { if (currentData) drawTrend(currentData); });
for (const option of document.querySelectorAll('.range')) option.setAttribute('aria-pressed', String(Number(option.dataset.minutes) === minutes));
byId('export').addEventListener('click', () => {
  if (!currentData) return;
  const file = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = 'trawl-metrics.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
</script>
</body>
</html>`
