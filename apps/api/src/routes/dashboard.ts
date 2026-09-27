import { timingSafeEqual } from "node:crypto"
import { Elysia } from "elysia"
import { METRICS_DASHBOARD_TOKEN } from "../config"
import { type MetricsStore, metrics } from "../metrics"
import { dashboardPage } from "./dashboardPage"

function validToken(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false
  const supplied = Buffer.from(header.slice(7))
  const expected = Buffer.from(secret)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function dashboardRoute(secret = METRICS_DASHBOARD_TOKEN, store: MetricsStore = metrics) {
  const app = new Elysia()
  if (!secret) return app
  return app
    .get("/dashboard", ({ set }) => {
      set.headers["Content-Type"] = "text/html; charset=utf-8"
      set.headers["Cache-Control"] = "no-store"
      set.headers["Content-Security-Policy"] =
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
      return dashboardPage
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
