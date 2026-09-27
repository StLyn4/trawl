import { describe, expect, test } from "bun:test"
import { MetricsStore } from "../metrics"
import { dashboardRoute } from "./dashboard"

const TOKEN = "this-is-a-long-dashboard-token-for-tests"

describe("local metrics dashboard", () => {
  test("does not register routes until a token is configured", async () => {
    const app = dashboardRoute("", new MetricsStore())
    expect((await app.handle(new Request("http://localhost/dashboard"))).status).toBe(404)
    expect((await app.handle(new Request("http://localhost/dashboard/metrics"))).status).toBe(404)
  })

  test("serves a dashboard shell without data and requires bearer auth for JSON", async () => {
    const store = new MetricsStore()
    store.record({ source: "mcp", url: "https://sensitive.example/path?secret=1", statusCode: 502, durationMs: 10 })
    const app = dashboardRoute(TOKEN, store)
    const shell = await app.handle(new Request("http://localhost/dashboard"))
    const html = await shell.text()
    expect(shell.status).toBe(200)
    expect(shell.headers.get("content-type")).toContain("text/html")
    expect(html).not.toContain("sensitive.example")
    expect(html).not.toContain(TOKEN)
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
    if (!script) throw new Error("Dashboard script is missing")
    expect(() => new Function(script)).not.toThrow()

    const noAuth = await app.handle(new Request("http://localhost/dashboard/metrics"))
    const wrongAuth = await app.handle(
      new Request("http://localhost/dashboard/metrics", { headers: { authorization: "Bearer wrong" } }),
    )
    expect(noAuth.status).toBe(401)
    expect(wrongAuth.status).toBe(401)
    expect(await wrongAuth.text()).not.toContain("sensitive.example")

    const authorized = await app.handle(
      new Request("http://localhost/dashboard/metrics", { headers: { authorization: `Bearer ${TOKEN}` } }),
    )
    expect(authorized.status).toBe(200)
    expect(authorized.headers.get("cache-control")).toBe("no-store")
    const body = await authorized.json()
    expect(body.domains[0].domain).toBe("sensitive.example")
    expect(JSON.stringify(body)).not.toContain("secret=1")
  })
})
