import { describe, expect, test } from "bun:test"
import { ScrapeError } from "@trawl/tiers"
import { MetricsStore } from "./metrics"

describe("local metrics", () => {
  test("keeps collection off when the dashboard is disabled", () => {
    const store = new MetricsStore(false)
    store.recordTierZeroAttempt()
    store.record({ source: "native", url: "https://example.com", statusCode: 200, durationMs: 1, tier: 1 })
    expect(store.snapshot().requests).toBe(0)
    expect(store.snapshot().byTier[0].attempts).toBe(0)
  })

  test("counts requests and tier outcomes without retaining URL secrets or raw errors", () => {
    const store = new MetricsStore()
    store.record({
      source: "mcp",
      url: "https://user:password@example.com/private/token?key=secret",
      durationMs: 20,
      tier: 3,
      statusCode: 200,
      attempts: [
        { tier: 1, status: "blocked", durationMs: 4, reason: "secret" },
        { tier: 2, status: "skipped", durationMs: 0 },
        { tier: 3, status: "success", durationMs: 10 },
      ],
    })
    store.record({
      source: "native",
      url: "https://example.com/another?token=secret",
      durationMs: 30,
      error: new ScrapeError("secret URL https://example.com/private", [
        { tier: 1, status: "blocked", durationMs: 8, reason: "secret" },
      ]),
    })

    const snapshot = store.snapshot()
    expect(snapshot.requests).toBe(2)
    expect(snapshot.successes).toBe(1)
    expect(snapshot.failures).toBe(1)
    expect(snapshot.averageMs).toBe(25)
    expect(snapshot.lastHour.at(-1)).toMatchObject({ requests: 2, failures: 1 })
    expect(snapshot.byTier[1]).toEqual({ attempts: 2, successes: 0 })
    expect(snapshot.byTier[2]).toEqual({ attempts: 0, successes: 0 })
    expect(snapshot.byTier[3]).toEqual({ attempts: 1, successes: 1 })
    expect(snapshot.byFailure.blocked).toBe(1)
    expect(snapshot.domains[0]).toEqual({ domain: "example.com", requests: 2, failures: 1 })
    expect(snapshot.recentFailures[0]?.severity).toBe("warning")
    expect(snapshot.recentFailures[0]).toMatchObject({ tier: 1, tierStatus: "blocked", statusCode: null })
    expect(JSON.stringify(snapshot)).not.toMatch(/secret|password|private|token|reason/)
  })

  test("counts direct proxy responses and bounds retained domains and failures", () => {
    const store = new MetricsStore()
    store.recordTierZeroAttempt()
    store.record({ source: "proxy", url: "https://ok.example", tier: 0, statusCode: 200, durationMs: 2 })
    for (let index = 0; index < 120; index++) {
      store.record({
        source: "proxy",
        url: `https://site-${index}.example/path`,
        tier: 0,
        statusCode: 503,
        durationMs: 3,
      })
    }
    const snapshot = store.snapshot()
    expect(snapshot.requests).toBe(121)
    expect(snapshot.byTier[0]).toEqual({ attempts: 1, successes: 1 })
    expect(snapshot.byFailure.http).toBe(120)
    expect(snapshot.bySeverity.error).toBe(120)
    expect(snapshot.recentFailures[0]).toMatchObject({ tier: 0, tierStatus: null, statusCode: 503 })
    expect(snapshot.recentFailures).toHaveLength(50)
    expect(snapshot.lastHour.length).toBeLessThanOrEqual(60)
    expect(snapshot.domains).toHaveLength(20)
    expect(snapshot.domains.some((entry) => entry.domain === "ok.example")).toBe(false)
  })
})
