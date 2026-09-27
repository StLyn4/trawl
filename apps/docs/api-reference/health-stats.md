---
title: Health & Stats
description: GET /, GET /health and GET /stats — status and monitoring endpoints.
---

# Health & Stats

These endpoints require no authentication and are safe to expose to monitoring tools.

---

## `GET /`

FlareSolverr-style readiness message — confirms the API process is up (does not wait on the browser pool).

### Response

```json
{
  "msg": "TRAWL is ready!",
  "version": "1.6.5",
  "uptime": 42
}
```

### Curl

```bash
curl -s http://localhost:8191/
```

---

## `GET /health`

Full system health check. Used by Docker Compose health checks and monitoring systems.

### Response

```json
{
  "status": "ok",
  "uptime": 3842,
  "pool": {
    "total": 1,
    "busy": 1,
    "available": 0,
    "restarts": 0,
    "avgRestarts": 0,
    "stalled": 0,
    "live": 1
  },
  "memory": {
    "currentBytes": 734003200,
    "limitBytes": 1073741824,
    "recommendedLimitBytes": 1073741824,
    "underProvisioned": false,
    "oomEvents": 0,
    "oomKills": 0
  }
}
```

| Field              | Type   | Description                              |
| ------------------ | ------ | ---------------------------------------- |
| `status`           | string | `"ok"` when the pool has live capacity; otherwise `"starting"` |
| `uptime`           | number | Seconds since the API process started    |
| `pool.total`       | number | Total browser instances in the pool      |
| `pool.busy`        | number | Browsers currently processing a request  |
| `pool.available`   | number | Browsers ready to accept a request       |
| `pool.restarts`    | number | Total browser restarts since worker boot |
| `pool.avgRestarts` | number | Average restarts per browser             |
| `pool.stalled`     | number | Checked-out browsers past their deadline |
| `pool.live`        | number | Connected, non-stalled browser capacity  |
| `memory.currentBytes` | number | Current cgroup memory usage |
| `memory.limitBytes` | number | Cgroup memory limit |
| `memory.recommendedLimitBytes` | number | Recommended minimum for the configured browser pools |
| `memory.underProvisioned` | boolean | Whether the detected limit is below the recommendation |
| `memory.oomEvents` | number | OOM events reported by the cgroup |
| `memory.oomKills` | number | OOM kills reported by the cgroup |

`/health` returns HTTP 503 while the pool is warming up or has no live browser capacity. A saturated but healthy pool remains ready because active, connected requests still count as live.
The optional `memory` object is included when Linux cgroup memory data is available; its presence does not affect readiness.

### Curl

```bash
curl -s http://localhost:8191/health | jq
```

---

## `GET /stats`

Lightweight public stats for dashboards and landing pages.

### Response

```json
{
  "browsers": 5,
  "available": 4,
  "busy": 1,
  "restarts": 0,
  "stalled": 0,
  "live": 5
}
```

| Field       | Type   | Description                          |
| ----------- | ------ | ------------------------------------ |
| `browsers`  | number | Total browser pool size              |
| `available` | number | Idle browsers                        |
| `busy`      | number | Browsers in use                      |
| `restarts`  | number | Total browser restarts since startup |
| `stalled`   | number | Checked-out browsers past their deadline |
| `live`      | number | Connected, non-stalled browser capacity |

### Curl

```bash
curl -s http://localhost:8191/stats | jq
```

### Prometheus / uptime monitoring

Point an uptime monitor (e.g. UptimeRobot, Uptime Kuma) at `/health`. A 200 response with `"status": "ok"` confirms full operation.

For Prometheus, scrape `/stats` and parse its JSON. A Prometheus exposition
endpoint is not currently provided.

## Local metrics dashboard

Set `METRICS_DASHBOARD_TOKEN` to a random value of at least 32 characters to
enable `GET /dashboard` and `GET /dashboard/metrics`. Open `http://localhost:8191/dashboard`
and enter the token. The JSON endpoint requires `Authorization: Bearer <token>`;
unauthorized requests receive HTTP 401. Both responses are marked `no-store`.
Keep the dashboard on a trusted network and use HTTPS when connecting remotely.

The dashboard counts completed scraper operations from `/scrape`, `/v1`, MCP,
and the MITM proxy. Direct proxy HTTP responses count as Tier 0; responses that
escalate count once under the scraper result. Tier attempts exclude skipped
tiers. HTTP responses with status 400 or higher count as failures. Direct
streamed responses are counted when their headers arrive; later stream errors
are not tracked. WebSocket relays and requests rejected before the scraper starts
are not counted.

It shows request totals, source and tier counts, average elapsed time, categorized
failures, severity, active minute buckets from the last hour, recent failures and
the busiest failing hostnames. Categories
are `blocked`, `timeout`, `capacity`, `network`, `http` and `internal`; they are
best-effort classifications, not a diagnosis of a target site. `warning` means
a target, network or capacity issue; `error` covers HTTP 5xx and unclassified
internal failures.

Metrics collection is disabled until the token is set. Metrics remain in this
API process only and reset on restart. The collector
retains at most 100 recent hostnames, 50 recent failure entries and 60 minute
buckets; the dashboard
shows at most 20 hostnames. URL paths, queries, fragments, credentials, raw error
messages, HTML, headers and cookies are never stored in it. No metrics are sent
to a remote server. The existing public `/stats` response contains only browser
pool capacity and does not expose target hostnames.
