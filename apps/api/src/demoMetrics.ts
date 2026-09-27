import { PoolExhaustedError } from "@trawl/browser"
import type { TierResult } from "@trawl/types"
import { MetricsStore } from "./metrics"
import type { ScrapeSource } from "./requestLogging"

// Isolated, in-memory sample history for product screenshots. No sample event is
// written to the persistent metrics store or emitted on its live event stream.
let sample: { minute: number; store: MetricsStore } | undefined

const domains = [
  "catalog.example",
  "news.example",
  "tickets.example",
  "shop.example",
  "media.example",
  "forum.example",
] as const

function seed(store: MetricsStore, minute: number): void {
  let ordinal = 0
  for (let bucket = 0; bucket < 48; bucket++) {
    const volume = Math.max(3, Math.round(9 + 4 * Math.sin(bucket * 0.53) + 2 * Math.cos(bucket * 0.19)))
    for (let position = 0; position < volume; position++) {
      const ageMs = (47 - bucket) * 30 * 60_000 + ((volume - position) / (volume + 1)) * 28 * 60_000
      const at = Math.round(minute - ageMs)
      const source: ScrapeSource =
        ordinal % 13 === 0 ? "mcp" : ordinal % 9 === 0 ? "proxy" : ordinal % 4 === 0 ? "flaresolverr" : "native"
      const tier =
        source === "proxy" && ordinal % 2 === 0
          ? 0
          : ordinal % 23 === 0
            ? 4
            : ordinal % 5 === 0
              ? 3
              : ordinal % 7 === 0
                ? 2
                : 1
      const durationMs =
        tier === 0
          ? 65 + (ordinal % 7) * 18
          : tier === 1
            ? 240 + (ordinal % 11) * 97
            : tier === 2
              ? 900 + (ordinal % 8) * 180
              : tier === 3
                ? 3900 + (ordinal % 9) * 720
                : 12_000 + (ordinal % 7) * 1900
      const failure = ordinal % 17 === 0 ? ordinal % 5 : undefined
      const status: TierResult["status"] =
        failure === 0 ? "blocked" : failure === 1 ? "timeout" : failure === undefined ? "success" : "error"
      const attempts: TierResult[] = []
      if (tier >= 2) attempts.push({ tier: 1, status: "needs-js", durationMs: 280 })
      if (tier >= 3) attempts.push({ tier: 2, status: "blocked", durationMs: 180 })
      attempts.push({ tier: tier as TierResult["tier"], status, durationMs })
      const error =
        failure === 2 ? new PoolExhaustedError() : failure === 3 ? new Error("network unavailable") : undefined
      const statusCode = failure === 0 ? 403 : failure === 4 ? 502 : failure === undefined ? 200 : undefined
      store.record(
        {
          source,
          url: `https://${domains[(ordinal * 7 + bucket) % domains.length]}/`,
          durationMs,
          tier: tier as TierResult["tier"],
          attempts,
          statusCode,
          error,
        },
        at,
      )
      ordinal++
    }
  }
  // Older daily samples keep the 7-day and 30-day demo charts meaningful too.
  for (let day = 1; day < 30; day++) {
    const volume = 8 + ((day * 7) % 9)
    for (let position = 0; position < volume; position++) {
      const tier = position % 6 === 0 ? 3 : 1
      const blocked = position === 0 && day % 3 === 0
      const durationMs = tier === 3 ? 5400 + position * 170 : 320 + position * 72
      store.record(
        {
          source: position % 5 === 0 ? "flaresolverr" : "native",
          url: `https://${domains[(day + position) % domains.length]}/`,
          durationMs,
          tier,
          attempts: [{ tier, status: blocked ? "blocked" : "success", durationMs }],
          statusCode: blocked ? 403 : 200,
        },
        minute - day * 24 * 60 * 60_000 - 60 * 60_000 - position * 3 * 60_000,
      )
    }
  }
}

export function demoSnapshot(minutes: 15 | 60 | 1440 | 10080 | 43200) {
  const minute = Math.floor(Date.now() / 60_000) * 60_000
  if (sample?.minute !== minute) {
    sample?.store.close()
    const store = new MetricsStore()
    seed(store, minute)
    sample = { minute, store }
  }
  return sample.store.snapshot(minutes)
}
