import { describe, expect, test } from "bun:test"
import type { BrowserHandle } from "@trawl/browser"
import type { TierResult } from "@trawl/types"
import { type OrchestratorDeps, ScrapeError, scrape } from "../src/orchestrator"
import { ProxyPool } from "../src/utils/proxyRotator"

const payload = {
  html: "<html><body>Destination</body></html>",
  effectiveUrl: "https://example.test/final",
  body: new Uint8Array([1, 2, 3]),
  responseHeaders: { "set-cookie": "private-cookie=value" },
  contentType: "text/html",
  statusCode: 200,
  internalOnly: "must-not-leak",
}

function dependencies(minTier: TierResult["tier"], attempts: TierResult[]): OrchestratorDeps {
  const handle: BrowserHandle = {
    id: 1,
    lease: 1,
    headful: false,
    context: {},
    browser: {},
    fingerprint: { userAgent: "test-agent", platform: "Linux x86_64", locale: "en-US", timezone: "UTC" },
  }
  return {
    minTier,
    acquireBrowser: async () => handle,
    releaseBrowser: () => {},
    loadSession: async () => ({ cookies: [], userAgent: "cached-agent", savedAt: 1 }),
    saveSession: async () => {},
    invalidateSession: async () => {},
    residentialProxyPool: new ProxyPool(["http://residential.test:8080"]),
    onTierAttempt: (attempt) => attempts.push(attempt),
  }
}

function runners(status: TierResult["status"], reason?: string) {
  const result = { ...payload, status, durationMs: 12, ...(reason === undefined ? {} : { reason }) }
  return {
    tier1: async () => ({ ...result, tier: 1 as const }),
    tier2: async () => ({ ...result, tier: 2 as const }),
    tier3: async () => ({ ...result, tier: 3 as const }),
    tier4: async () => ({ ...result, tier: 4 as const }),
  }
}

describe("public tier attempt metadata", () => {
  for (const tier of [1, 2, 3, 4] as const) {
    for (const reason of [undefined, "completed"]) {
      test(`Tier ${tier} strips internal fields ${reason === undefined ? "without" : "with"} a reason`, async () => {
        const attempts: TierResult[] = []
        const result = await scrape(
          { url: "https://example.test", maxTier: tier },
          dependencies(tier, attempts),
          runners("success", reason),
        )
        const expected = [{ tier, status: "success", durationMs: 12, ...(reason === undefined ? {} : { reason }) }]
        expect(result.timings).toStrictEqual(expected)
        expect(attempts).toStrictEqual(expected)
        expect(result.html).toBe(payload.html)
        expect(result.body).toEqual(payload.body)
        expect(result.responseHeaders).toEqual(payload.responseHeaders)
      })
    }
  }

  test("filters every attempt during escalation", async () => {
    const attempts: TierResult[] = []
    const failed = runners("blocked", "challenge")
    const result = await scrape({ url: "https://example.test" }, dependencies(1, attempts), {
      ...failed,
      tier4: runners("success").tier4,
    })
    const expected = [
      { tier: 1, status: "blocked", durationMs: 12, reason: "challenge" },
      { tier: 2, status: "blocked", durationMs: 12, reason: "challenge" },
      { tier: 3, status: "blocked", durationMs: 12, reason: "challenge" },
      { tier: 4, status: "success", durationMs: 12 },
    ]
    expect(result.timings).toStrictEqual(expected)
    expect(attempts).toStrictEqual(expected)
  })

  test("filters failed attempts carried by ScrapeError", async () => {
    const attempts: TierResult[] = []
    let failure: unknown
    try {
      await scrape({ url: "https://example.test", maxTier: 1 }, dependencies(1, attempts), runners("error", "failed"))
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(ScrapeError)
    if (!(failure instanceof ScrapeError)) throw new Error("Expected scrape to fail")
    const expected = [{ tier: 1, status: "error", durationMs: 12, reason: "failed" }]
    expect(failure.timings).toStrictEqual(expected)
    expect(attempts).toStrictEqual(expected)
  })
})
