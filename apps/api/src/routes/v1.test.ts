import { describe, expect, test } from "bun:test"
import { type OrchestratorDeps, ScrapeError } from "@trawl/tiers"
import { MetricsStore } from "../metrics"
import { v1Route } from "./v1"

describe("POST /v1", () => {
  test("returns a FlareSolverr error envelope when an explicit proxy fails", async () => {
    const metricsStore = new MetricsStore()
    const app = v1Route({
      poolReady: () => true,
      orchestratorDeps: () => ({}) as OrchestratorDeps,
      runScrape: async () => {
        throw new ScrapeError("All tiers exhausted. Last failure: proxy-connection-failed", [
          { tier: 1, status: "error", durationMs: 1, reason: "proxy-connection-failed" },
        ])
      },
      metricsStore,
    })

    const response = await app.handle(
      new Request("http://localhost/v1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cmd: "request.get",
          url: "https://target.example",
          proxy: "http://proxy.example:8080",
        }),
      }),
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      status: "error",
      message: "All tiers exhausted. Last failure: proxy-connection-failed",
      solution: { url: "https://target.example", status: 0, response: "" },
    })
    expect(metricsStore.snapshot().requests).toBe(1)
    metricsStore.close()
  })

  test("records commands rejected before scraping", async () => {
    const metricsStore = new MetricsStore()
    const app = v1Route({ poolReady: () => false, metricsStore })
    const send = (body: unknown) =>
      app.handle(
        new Request("http://localhost/v1", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      )
    expect((await send({ url: "https://target.example", cmd: "request.get" })).status).toBe(503)
    expect((await send({ url: "https://target.example", cmd: "unknown" })).status).toBe(400)
    expect((await send({ cmd: "request.get" })).status).toBe(400)
    expect(metricsStore.snapshot().requests).toBe(3)
    expect(metricsStore.snapshot().failures).toBe(3)
    metricsStore.close()
  })
})
