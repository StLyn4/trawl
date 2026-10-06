import type { Page } from "patchright"
import { hasAnubisChallenge } from "./detect"

type Resolution = "ok" | "timeout"

// Anubis resolves itself in a browser by running a PoW challenge, so just wait until its gone
export async function waitForAnubisResolution(
  page: Page,
  timeoutMs: number,
  _originalUrl?: string,
): Promise<Resolution> {
  const deadline = Date.now() + Math.max(timeoutMs, 0)
  while (Date.now() < deadline) {
    const html = await page.content().catch(() => "")
    if (html.length > 0 && !hasAnubisChallenge(html)) {
      await page.waitForLoadState("load", { timeout: 5000 }).catch(() => {})
      return "ok"
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(300, Math.max(1, deadline - Date.now()))))
  }
  return "timeout"
}
