import { PoolExhaustedError } from "@trawl/browser"
import { RequestValidationError, scrape } from "@trawl/tiers"
import type { FlareSolverrRequest, FlareSolverrResponse } from "@trawl/types"
import { Elysia } from "elysia"
import { buildScrapeRequestFromFlareSolverr, flareSolverrError } from "../adapters/flaresolverr"
import { getDeps, getPool } from "../deps"
import { type MetricsStore, metrics } from "../metrics"
import { runLoggedScrape } from "../requestLogging"
import { requestUrl, validateFlareSolverrRequest } from "../validation"

// FlareSolverr v2 compat — always open (the v2 spec has no auth header)
interface V1RouteOptions {
  runScrape?: typeof scrape
  poolReady?: () => boolean
  orchestratorDeps?: typeof getDeps
  metricsStore?: MetricsStore
}

export function v1Route({
  runScrape = scrape,
  poolReady = () => Boolean(getPool()),
  orchestratorDeps = getDeps,
  metricsStore = metrics,
}: V1RouteOptions = {}) {
  return new Elysia().post("/v1", async ({ body, set }) => {
    const startTimestamp = Date.now()
    let scraperStarted = false

    try {
      validateFlareSolverrRequest(body)
      const req: FlareSolverrRequest = body
      const cmd = req.cmd ?? "request.get"

      if (cmd !== "request.get" && cmd !== "request.post") {
        set.status = 400
        metricsStore.record({
          source: "flaresolverr",
          url: req.url,
          durationMs: Date.now() - startTimestamp,
          statusCode: 400,
        })
        return flareSolverrError(req.url, `Unknown cmd: ${cmd}`)
      }

      if (!poolReady()) {
        set.status = 503
        metricsStore.record({
          source: "flaresolverr",
          url: req.url,
          durationMs: Date.now() - startTimestamp,
          statusCode: 503,
        })
        return flareSolverrError(req.url, "Browser pool initializing, retry in a few seconds")
      }

      const scrapeRequest = buildScrapeRequestFromFlareSolverr(req)
      const deps = orchestratorDeps()
      scraperStarted = true
      const result = await runLoggedScrape("flaresolverr", scrapeRequest, deps, runScrape, undefined, metricsStore)
      return {
        status: "ok",
        message: "",
        startTimestamp,
        endTimestamp: Date.now(),
        version: "2.0.0",
        solution: {
          url: result.url,
          status: result.statusCode,
          headers: {},
          response: result.html,
          cookies: result.cookies,
          userAgent: result.userAgent,
        },
      } satisfies FlareSolverrResponse
    } catch (err) {
      if (err instanceof RequestValidationError) {
        set.status = err.statusCode
        if (!scraperStarted)
          metricsStore.record({
            source: "flaresolverr",
            url: requestUrl(body),
            durationMs: Date.now() - startTimestamp,
            statusCode: err.statusCode,
            error: err,
          })
        return flareSolverrError(requestUrl(body), err.message)
      }
      set.status = err instanceof PoolExhaustedError ? 429 : 500
      if (!scraperStarted)
        metricsStore.record({
          source: "flaresolverr",
          url: requestUrl(body),
          durationMs: Date.now() - startTimestamp,
          statusCode: err instanceof PoolExhaustedError ? 429 : 500,
          error: err,
        })
      return flareSolverrError(requestUrl(body), err instanceof Error ? err.message : String(err))
    }
  })
}
