import { timingSafeEqual } from "node:crypto"
import { Elysia } from "elysia"
import { METRICS_DASHBOARD_TOKEN } from "../config"
import { type MetricsStore, metrics } from "../metrics"

function validToken(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false
  const supplied = Buffer.from(header.slice(7))
  const expected = Buffer.from(secret)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TRAWL metrics</title>
<style>
:root{font:15px system-ui,sans-serif;color:#e7edf5;background:#101720;color-scheme:dark}
body{max-width:1100px;margin:auto;padding:24px}h1{margin-bottom:4px}p{color:#aebcca}
form{display:flex;gap:8px;margin:24px 0}input,button{font:inherit;padding:10px;border-radius:8px;border:1px solid #47576a;background:#1b2836;color:inherit}input{flex:1}button{cursor:pointer;background:#286ed2;border-color:#286ed2}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.card,section{background:#192430;border:1px solid #314153;border-radius:10px;padding:16px}.card b{display:block;font-size:26px}.card span{color:#aebcca}section{margin-top:16px;overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:8px;border-bottom:1px solid #314153}th{color:#aebcca}#error{color:#ffb4b4}
</style></head><body>
<h1>TRAWL metrics</h1><p>Local process metrics · hostnames only · resets on restart</p>
<form id="login"><input id="token" type="password" autocomplete="off" placeholder="Dashboard token" aria-label="Dashboard token" required><button>Open dashboard</button></form>
<p id="error" role="alert"></p><main id="content" hidden>
<div class="grid" id="totals"></div>
<section><h2>Recent minutes</h2><table><thead><tr><th>Minute</th><th>Requests</th><th>Failures</th></tr></thead><tbody id="minutes"></tbody></table></section>
<section><h2>Request sources</h2><table><thead><tr><th>Source</th><th>Requests</th></tr></thead><tbody id="sources"></tbody></table></section>
<section><h2>Tier outcomes</h2><table><thead><tr><th>Tier</th><th>Attempts</th><th>Wins</th></tr></thead><tbody id="tiers"></tbody></table></section>
<section><h2>Failure categories</h2><table><thead><tr><th>Category</th><th>Count</th></tr></thead><tbody id="categories"></tbody></table></section>
<section><h2>Failure severity</h2><table><thead><tr><th>Severity</th><th>Count</th></tr></thead><tbody id="severity"></tbody></table></section>
<section><h2>Domains with failures</h2><table><thead><tr><th>Domain</th><th>Requests</th><th>Failures</th></tr></thead><tbody id="domains"></tbody></table></section>
<section><h2>Recent failures</h2><table><thead><tr><th>Time</th><th>Domain</th><th>Source</th><th>Tier</th><th>Tier status</th><th>HTTP</th><th>Category</th><th>Severity</th></tr></thead><tbody id="failures"></tbody></table></section>
</main><script>
let token = '';
let timer;
const byId = id => document.getElementById(id);

function rows(id, items) {
  const body = byId(id);
  body.replaceChildren();
  for (const values of items) {
    const row = document.createElement('tr');
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = String(value);
      row.append(cell);
    }
    body.append(row);
  }
}

function card(label, value) {
  const node = document.createElement('div');
  node.className = 'card';
  const number = document.createElement('b');
  number.textContent = String(value);
  const caption = document.createElement('span');
  caption.textContent = label;
  node.append(number, caption);
  return node;
}

async function refresh() {
  try {
    const response = await fetch('/dashboard/metrics', {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store'
    });
    if (!response.ok) throw Error(response.status === 401 ? 'Invalid token' : 'Metrics unavailable');
    const data = await response.json();
    byId('error').textContent = '';
    byId('content').hidden = false;
    byId('totals').replaceChildren(
      card('Requests', data.requests), card('Succeeded', data.successes),
      card('Failed', data.failures), card('Average ms', data.averageMs)
    );
    rows('minutes', data.lastHour.slice().reverse().map(x => [new Date(x.minute).toLocaleTimeString(), x.requests, x.failures]));
    rows('sources', Object.entries(data.bySource).map(([name, count]) => [name, count]));
    rows('tiers', Object.entries(data.byTier).map(([tier, x]) => [tier, x.attempts, x.successes]));
    rows('categories', Object.entries(data.byFailure).map(([name, count]) => [name, count]));
    rows('severity', Object.entries(data.bySeverity).map(([name, count]) => [name, count]));
    rows('domains', data.domains.filter(x => x.failures).map(x => [x.domain, x.requests, x.failures]));
    rows('failures', data.recentFailures.map(x => [
      new Date(x.at).toLocaleString(), x.domain, x.source, x.tier ?? '—',
      x.tierStatus ?? '—', x.statusCode ?? '—', x.category, x.severity
    ]));
  } catch (error) {
    byId('error').textContent = error.message;
    byId('content').hidden = true;
    clearInterval(timer);
  }
}

byId('login').addEventListener('submit', event => {
  event.preventDefault();
  token = byId('token').value;
  byId('token').value = '';
  clearInterval(timer);
  refresh();
  timer = setInterval(refresh, 10000);
});
</script></body></html>`

export function dashboardRoute(secret = METRICS_DASHBOARD_TOKEN, store: MetricsStore = metrics) {
  const app = new Elysia()
  if (!secret) return app
  return app
    .get("/dashboard", ({ set }) => {
      set.headers["Content-Type"] = "text/html; charset=utf-8"
      set.headers["Cache-Control"] = "no-store"
      set.headers["Content-Security-Policy"] =
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
      return page
    })
    .get("/dashboard/metrics", ({ request, set }) => {
      set.headers["Cache-Control"] = "no-store"
      if (!validToken(request.headers.get("authorization"), secret)) {
        set.status = 401
        return { error: "Unauthorized" }
      }
      return store.snapshot()
    })
}
