import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { PoolExhaustedError } from "@trawl/browser"
import { ScrapeError } from "@trawl/tiers"
import type { TierResult } from "@trawl/types"
import { METRICS_DASHBOARD_ENABLED, METRICS_DASHBOARD_TOKEN } from "./config"
import type { ScrapeSource } from "./requestLogging"

type Tier = 0 | 1 | 2 | 3 | 4
type FailureCategory = "blocked" | "timeout" | "capacity" | "network" | "http" | "internal"
type Severity = "warning" | "error"
type Range = 15 | 60 | 1440 | 10080 | 43200
export const metricRanges = [15, 60, 1440, 10080, 43200] as const
const MAX_EVENTS = 50_000
const RETENTION_MS = 30 * 24 * 60 * 60_000

export interface MetricEvent {
  source: ScrapeSource
  url: string
  durationMs: number
  tier?: Tier
  attempts?: TierResult[]
  statusCode?: number
  error?: unknown
}

interface StoredEvent {
  id: number
  at: number
  domain: string
  source: ScrapeSource
  duration_ms: number
  success: number
  tier: Tier | null
  tier_status: TierResult["status"] | null
  status_code: number | null
  category: FailureCategory | null
  severity: Severity | null
}

const TIERS = [0, 1, 2, 3, 4] as const
const SOURCES = ["native", "flaresolverr", "mcp", "proxy"] as const
const CATEGORIES = ["blocked", "timeout", "capacity", "network", "http", "internal"] as const

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().slice(0, 253) || "unknown"
  } catch {
    return "unknown"
  }
}

function failureKind(
  error: unknown,
  attempts: TierResult[],
  statusCode?: number,
): { category: FailureCategory; severity: Severity } {
  if (error instanceof PoolExhaustedError) return { category: "capacity", severity: "warning" }
  const terminal = attempts.at(-1)
  if (terminal?.status === "blocked" || terminal?.status === "needs-js") {
    return { category: "blocked", severity: "warning" }
  }
  if (terminal?.status === "timeout") return { category: "timeout", severity: "warning" }
  if (statusCode === 403 || statusCode === 429) return { category: "blocked", severity: "warning" }
  if (statusCode && statusCode >= 400) return { category: "http", severity: statusCode >= 500 ? "error" : "warning" }
  if (error instanceof ScrapeError && /timeout|timed out|deadline/i.test(error.message)) {
    return { category: "timeout", severity: "warning" }
  }
  if (error instanceof Error && /ECONN|ENOTFOUND|EAI_AGAIN|network|socket|TLS/i.test(error.message)) {
    return { category: "network", severity: "warning" }
  }
  return { category: "internal", severity: "error" }
}

export class MetricsStore {
  private db?: Database
  private listeners = new Set<() => void>()
  private recorded = 0

  constructor(enabled = true, path = ":memory:") {
    if (!enabled) return
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true })
    this.db = new Database(path, { create: true })
    this.db.run("PRAGMA journal_mode = WAL")
    this.db.run("PRAGMA foreign_keys = ON")
    this.db.run("PRAGMA busy_timeout = 1000")
    this.db.run(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, at INTEGER NOT NULL, domain TEXT NOT NULL, source TEXT NOT NULL,
      duration_ms INTEGER NOT NULL, success INTEGER NOT NULL, tier INTEGER, tier_status TEXT,
      status_code INTEGER, category TEXT, severity TEXT
    )`)
    this.db.run(`CREATE TABLE IF NOT EXISTS tier_attempts (
      id INTEGER PRIMARY KEY, at INTEGER NOT NULL, event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      tier INTEGER NOT NULL
    )`)
    this.db.run("CREATE INDEX IF NOT EXISTS events_at ON events(at)")
    this.db.run("CREATE INDEX IF NOT EXISTS attempts_at ON tier_attempts(at)")
    this.prune()
  }

  close(): void {
    this.listeners.clear()
    this.db?.close()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  private prune(): void {
    const db = this.db
    if (!db) return
    const cutoff = Date.now() - RETENTION_MS
    db.query("DELETE FROM events WHERE at < ?").run(cutoff)
    db.query("DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT ?)").run(MAX_EVENTS)
    db.query(
      "DELETE FROM tier_attempts WHERE at < ? OR (event_id IS NULL AND id NOT IN (SELECT id FROM tier_attempts WHERE event_id IS NULL ORDER BY id DESC LIMIT ?))",
    ).run(cutoff, MAX_EVENTS)
  }

  recordTierZeroAttempt(): void {
    if (!this.db) return
    try {
      this.db.query("INSERT INTO tier_attempts(at, tier) VALUES (?, 0)").run(Date.now())
      if (++this.recorded % 100 === 0) this.prune()
      this.notify()
    } catch (error) {
      console.error("[metrics] failed to record tier attempt:", error)
    }
  }

  record(event: MetricEvent, at = Date.now()): void {
    const db = this.db
    if (!db) return
    const attempts = event.attempts ?? (event.error instanceof ScrapeError ? event.error.timings : [])
    const success =
      event.error === undefined && event.statusCode !== undefined && event.statusCode >= 200 && event.statusCode < 400
    const failure = success ? null : failureKind(event.error, attempts, event.statusCode)
    try {
      db.transaction(() => {
        const inserted = db
          .query(`INSERT INTO events(at, domain, source, duration_ms, success, tier, tier_status, status_code, category, severity)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(
            at,
            domainOf(event.url),
            event.source,
            Math.max(0, Math.round(event.durationMs)),
            Number(success),
            event.tier ?? attempts.at(-1)?.tier ?? null,
            attempts.at(-1)?.status ?? null,
            event.statusCode ?? null,
            failure?.category ?? null,
            failure?.severity ?? null,
          )
        for (const attempt of attempts) {
          if (attempt.status !== "skipped") {
            db.query("INSERT INTO tier_attempts(at, event_id, tier) VALUES (?, ?, ?)").run(
              at,
              inserted.lastInsertRowid,
              attempt.tier,
            )
          }
        }
      })()
      if (++this.recorded % 100 === 0) this.prune()
      this.notify()
    } catch (error) {
      // Metrics must never change the result of a scrape.
      console.error("[metrics] failed to record request:", error)
    }
  }

  snapshot(minutes: Range = 60) {
    const range = metricRanges.includes(minutes) ? minutes : 60
    const now = Date.now()
    const from = now - range * 60_000
    const db = this.db
    const events = db
      ? (db.query("SELECT * FROM events WHERE at >= ? ORDER BY id DESC").all(from) as StoredEvent[])
      : []
    const attempts = db
      ? (db.query("SELECT tier, COUNT(*) AS count FROM tier_attempts WHERE at >= ? GROUP BY tier").all(from) as {
          tier: Tier
          count: number
        }[])
      : []
    const bySource = Object.fromEntries(SOURCES.map((source) => [source, 0])) as Record<ScrapeSource, number>
    const byTier = Object.fromEntries(TIERS.map((tier) => [tier, { attempts: 0, successes: 0 }])) as Record<
      Tier,
      { attempts: number; successes: number }
    >
    const byFailure = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<FailureCategory, number>
    const bySeverity: Record<Severity, number> = { warning: 0, error: 0 }
    const domains = new Map<string, { requests: number; failures: number }>()
    let successes = 0
    let duration = 0
    for (const row of attempts) byTier[row.tier].attempts = row.count
    for (const row of events) {
      bySource[row.source]++
      duration += row.duration_ms
      if (row.success) {
        successes++
        if (row.tier !== null) byTier[row.tier].successes++
      } else {
        if (row.category) byFailure[row.category]++
        if (row.severity) bySeverity[row.severity]++
      }
      const counts = domains.get(row.domain) ?? { requests: 0, failures: 0 }
      counts.requests++
      counts.failures += Number(!row.success)
      domains.set(row.domain, counts)
    }
    const step =
      range <= 60 ? 60_000 : range <= 1440 ? 30 * 60_000 : range <= 10080 ? 4 * 60 * 60_000 : 24 * 60 * 60_000
    const end = Math.floor(now / step) * step
    const size = Math.ceil((range * 60_000) / step)
    const bins = new Map<
      number,
      {
        requests: number
        failures: number
        durationMs: number
        sources: Record<string, number>
        tiers: Record<string, number>
      }
    >()
    for (const row of events) {
      const key = Math.floor(row.at / step) * step
      const bucket = bins.get(key) ?? { requests: 0, failures: 0, durationMs: 0, sources: {}, tiers: {} }
      bucket.requests++
      bucket.failures += Number(!row.success)
      bucket.durationMs += row.duration_ms
      bucket.sources[row.source] = (bucket.sources[row.source] ?? 0) + 1
      if (row.tier !== null) bucket.tiers[row.tier] = (bucket.tiers[row.tier] ?? 0) + 1
      bins.set(key, bucket)
    }
    const timeline = Array.from({ length: size }, (_, index) => {
      const key = end - (size - index - 1) * step
      const bucket = bins.get(key) ?? { requests: 0, failures: 0, durationMs: 0, sources: {}, tiers: {} }
      return {
        minute: new Date(key).toISOString(),
        requests: bucket.requests,
        failures: bucket.failures,
        averageMs: bucket.requests ? Math.round(bucket.durationMs / bucket.requests) : 0,
        sources: bucket.sources,
        tiers: bucket.tiers,
      }
    })
    const first = db?.query("SELECT MIN(at) AS at FROM events").get() as { at: number | null } | undefined
    return {
      startedAt: first?.at ? new Date(first.at).toISOString() : null,
      rangeMinutes: range,
      retainedEvents: db ? (db.query("SELECT COUNT(*) AS count FROM events").get() as { count: number }).count : 0,
      requests: events.length,
      successes,
      failures: events.length - successes,
      averageMs: events.length ? Math.round(duration / events.length) : 0,
      bySource,
      byTier,
      byFailure,
      bySeverity,
      bucketMs: step,
      timeline,
      lastHour: timeline,
      domains: [...domains]
        .map(([domain, counts]) => ({ domain, ...counts }))
        .sort((a, b) => b.failures - a.failures)
        .slice(0, 20),
      recentEvents: events.slice(0, 100).map((row) => ({
        at: new Date(row.at).toISOString(),
        domain: row.domain,
        source: row.source,
        durationMs: row.duration_ms,
        success: Boolean(row.success),
        tier: row.tier,
        tierStatus: row.tier_status,
        statusCode: row.status_code,
        category: row.category,
        severity: row.severity,
      })),
      recentFailures: events
        .filter((row) => !row.success)
        .slice(0, 50)
        .map((row) => ({
          at: new Date(row.at).toISOString(),
          domain: row.domain,
          source: row.source,
          tier: row.tier,
          tierStatus: row.tier_status,
          statusCode: row.status_code,
          category: row.category,
          severity: row.severity,
        })),
    }
  }
}

export const metrics = new MetricsStore(
  Boolean(METRICS_DASHBOARD_TOKEN) || METRICS_DASHBOARD_ENABLED,
  process.env.METRICS_DB_PATH?.trim() || "/data/metrics/trawl.sqlite",
)
