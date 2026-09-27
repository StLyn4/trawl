import type { Page } from "patchright"
import { captureLimit } from "./utils/captureConfig"

// A screenshot is a best-effort side artifact of a scrape, so every step is bounded:
// the settle wait, the capture itself, and the size of the image we are willing to
// carry in the response. All are env-tunable.
const SETTLE_MS = captureLimit(process.env.SCREENSHOT_SETTLE_MS, 3_000)
const CAPTURE_TIMEOUT_MS = captureLimit(process.env.SCREENSHOT_TIMEOUT_MS, 10_000)
const configuredQuality = captureLimit(process.env.SCREENSHOT_JPEG_QUALITY, 60)
const JPEG_QUALITY = configuredQuality >= 1 && configuredQuality <= 100 ? configuredQuality : 60
const MAX_BYTES = captureLimit(process.env.SCREENSHOT_MAX_BYTES, 4_000_000)
const MAX_FULL_PAGE_HEIGHT = 6_000
const MAX_FULL_PAGE_PIXELS = 12_000_000
const SELECTOR_WAIT_MS = 10_000

export async function capturePageScreenshot(
  page: Page,
  budgetMs = Number.POSITIVE_INFINITY,
  options: { settle?: boolean; fullPage?: boolean; waitForSelector?: string } = {},
): Promise<string | undefined> {
  const deadline = Date.now() + Math.max(budgetMs, 0)
  const remaining = (): number => Math.max(deadline - Date.now(), 0)

  try {
    // The HTML is read the moment a challenge clears, before late content (images,
    // fonts, lazy hydration) has painted. Give the page a bounded chance to settle,
    // then a short beat for whatever paints after the last request. A caller imaging a
    // page that will never settle (a challenge wall) opts out of the wait.
    if (remaining() <= 0) return undefined
    if (options.waitForSelector) {
      const waitMs = Math.min(SELECTOR_WAIT_MS, remaining())
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          page.waitForSelector(options.waitForSelector, { state: "visible", timeout: waitMs }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("screenshot selector wait timed out")), waitMs)
          }),
        ])
      } finally {
        if (timer) clearTimeout(timer)
      }
    }
    if (options.settle !== false) {
      await page.waitForLoadState("networkidle", { timeout: Math.min(SETTLE_MS, remaining()) }).catch(() => {})
      const paintWaitMs = Math.min(300, remaining())
      if (paintWaitMs > 0) await new Promise((r) => setTimeout(r, paintWaitMs))
    }

    const captureTimeout = Math.min(CAPTURE_TIMEOUT_MS, remaining())
    if (captureTimeout <= 0) return undefined

    if (options.fullPage) {
      const size = await page.evaluate(() => ({
        width: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0, window.innerWidth),
        height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, window.innerHeight),
      }))
      if (
        !Number.isFinite(size.width) ||
        !Number.isFinite(size.height) ||
        size.height > MAX_FULL_PAGE_HEIGHT ||
        size.width * size.height > MAX_FULL_PAGE_PIXELS
      ) {
        console.log(
          `[screenshot] full-page capture exceeds ${MAX_FULL_PAGE_HEIGHT}px or ${MAX_FULL_PAGE_PIXELS} pixels`,
        )
        return undefined
      }
    }

    const image = await page.screenshot({
      type: "jpeg",
      quality: JPEG_QUALITY,
      timeout: captureTimeout,
      ...(options.fullPage ? { fullPage: true } : {}),
    })
    if (image.length > MAX_BYTES) {
      console.log(`[screenshot] dropped: ${image.length}b exceeds SCREENSHOT_MAX_BYTES=${MAX_BYTES}`)
      return undefined
    }
    return Buffer.from(image).toString("base64")
  } catch (err) {
    console.log(`[screenshot] capture failed: ${err instanceof Error ? err.message : String(err)}`)
    return undefined
  }
}
