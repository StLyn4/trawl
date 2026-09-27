import { PoolExhaustedError } from "@trawl/browser"
import { ScrapeError } from "@trawl/tiers"
import type { TierResult } from "@trawl/types"
import { METRICS_DASHBOARD_TOKEN } from "./config"
import type { ScrapeSource } from "./requestLogging"

type Tier = 0 | 1 | 2 | 3 | 4
type FailureCategory = "blocked" | "timeout" | "capacity" | "network" | "http" | "internal"
type Severity = "warning" | "error"

export interface MetricEvent {
  source: ScrapeSource
  url: string
  durationMs: number
  tier?: Tier
  attempts?: TierResult[]
  statusCode?: number
  error?: unknown
}

interface Failure {
  at: string
  domain: string
  source: ScrapeSource
  tier: Tier | null
  tierStatus: TierResult["status"] | null
  statusCode: number | null
  category: FailureCategory
  severity: Severity
}

const TIERS = [0, 1, 2, 3, 4] as const
const SOURCES = ["native", "flaresolverr", "mcp", "proxy"] as const
const CATEGORIES = ["blocked", "timeout", "capacity", "network", "http", "internal"] as const
const MAX_RECENT_FAILURES = 50
const MAX_DOMAINS = 100
const MAX_MINUTES = 60

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
  constructor(private readonly enabled = true) {}

  private startedAt = new Date().toISOString()
  private requests = 0
  private successes = 0
  private failures = 0
  private durationMs = 0
  private bySource = Object.fromEntries(SOURCES.map((source) => [source, 0])) as Record<ScrapeSource, number>
  private byTier = Object.fromEntries(TIERS.map((tier) => [tier, { attempts: 0, successes: 0 }])) as Record<
    Tier,
    { attempts: number; successes: number }
  >
  private byFailure = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<FailureCategory, number>
  private bySeverity: Record<Severity, number> = { warning: 0, error: 0 }
  private domains = new Map<string, { requests: number; failures: number }>()
  private recentFailures: Failure[] = []
  private minutes = new Map<number, { requests: number; failures: number }>()

  recordTierZeroAttempt(): void {
    if (!this.enabled) return
    this.byTier[0].attempts++
  }

  record(event: MetricEvent): void {
    if (!this.enabled) return
    const domain = domainOf(event.url)
    const attempts = event.attempts ?? (event.error instanceof ScrapeError ? event.error.timings : [])
    const succeeded =
      event.error === undefined && event.statusCode !== undefined && event.statusCode >= 200 && event.statusCode < 400
    this.requests++
    this.bySource[event.source]++
    this.durationMs += Math.max(0, event.durationMs)
    if (succeeded) this.successes++
    else this.failures++

    const minute = Math.floor(Date.now() / 60_000) * 60_000
    const oldest = minute - (MAX_MINUTES - 1) * 60_000
    for (const key of this.minutes.keys()) {
      if (key < oldest) this.minutes.delete(key)
    }
    const bucket = this.minutes.get(minute) ?? { requests: 0, failures: 0 }
    bucket.requests++
    if (!succeeded) bucket.failures++
    this.minutes.set(minute, bucket)
    if (this.minutes.size > MAX_MINUTES) this.minutes.delete(this.minutes.keys().next().value ?? minute)

    for (const attempt of attempts) {
      if (attempt.status !== "skipped") this.byTier[attempt.tier].attempts++
    }
    if (succeeded && event.tier !== undefined) this.byTier[event.tier].successes++

    const previous = this.domains.get(domain) ?? { requests: 0, failures: 0 }
    this.domains.delete(domain)
    this.domains.set(domain, {
      requests: previous.requests + 1,
      failures: previous.failures + (succeeded ? 0 : 1),
    })
    if (this.domains.size > MAX_DOMAINS) this.domains.delete(this.domains.keys().next().value ?? "")

    if (!succeeded) {
      const { category, severity } = failureKind(event.error, attempts, event.statusCode)
      this.byFailure[category]++
      this.bySeverity[severity]++
      this.recentFailures.unshift({
        at: new Date().toISOString(),
        domain,
        source: event.source,
        tier: event.tier ?? attempts.at(-1)?.tier ?? null,
        tierStatus: attempts.at(-1)?.status ?? null,
        statusCode: event.statusCode ?? null,
        category,
        severity,
      })
      if (this.recentFailures.length > MAX_RECENT_FAILURES) this.recentFailures.pop()
    }
  }

  snapshot() {
    return {
      startedAt: this.startedAt,
      requests: this.requests,
      successes: this.successes,
      failures: this.failures,
      averageMs: this.requests ? Math.round(this.durationMs / this.requests) : 0,
      bySource: { ...this.bySource },
      byTier: structuredClone(this.byTier),
      byFailure: { ...this.byFailure },
      bySeverity: { ...this.bySeverity },
      lastHour: Array.from({ length: MAX_MINUTES }, (_, index) => {
        const minute = Math.floor(Date.now() / 60_000) * 60_000 - (MAX_MINUTES - index - 1) * 60_000
        const counts = this.minutes.get(minute) ?? { requests: 0, failures: 0 }
        return { minute: new Date(minute).toISOString(), ...counts }
      }),
      domains: [...this.domains]
        .map(([domain, counts]) => ({ domain, ...counts }))
        .sort((a, b) => b.failures - a.failures)
        .slice(0, 20),
      recentFailures: this.recentFailures.map((failure) => ({ ...failure })),
    }
  }
}

export const metrics = new MetricsStore(Boolean(METRICS_DASHBOARD_TOKEN))
