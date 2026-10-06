import { describe, expect, test } from "bun:test"
import { browserDocumentHtml } from "../src/utils/response"

const viewerShell = (text: string) =>
  `<html><head><link rel="stylesheet" href="resource://content-accessible/plaintext.css"></head>` +
  `<body><pre>${text}</pre></body></html>`

describe("browserDocumentHtml", () => {
  test("keeps the rendered DOM for HTML documents", () => {
    expect(browserDocumentHtml("text/html; charset=utf-8", "<html><body>ok</body></html>")).toBe(
      "<html><body>ok</body></html>",
    )
  })

  test("keeps the rendered DOM when no content type was captured", () => {
    expect(browserDocumentHtml(undefined, viewerShell("unknown type"))).toBe(viewerShell("unknown type"))
  })

  test("returns the raw document for plain text instead of the browser viewer shell", () => {
    const raw = '{"compilerOptions":{"target":"ESNext"}}'
    expect(browserDocumentHtml("text/plain; charset=utf-8", viewerShell(raw), Buffer.from(raw))).toBe(raw)
  })

  test("returns the raw document for JSON content types", () => {
    const raw = '{"ok":[1,2,3]}'
    expect(browserDocumentHtml("application/json", viewerShell(raw), Buffer.from(raw))).toBe(raw)
  })

  test("returns the raw document for XML content types", () => {
    const raw = '<?xml version="1.0"?><rss><item>ok</item></rss>'
    expect(browserDocumentHtml("application/xml", viewerShell(raw), Buffer.from(raw))).toBe(raw)
  })

  test("treats xhtml as the rendered DOM", () => {
    const xhtml = '<html xmlns="http://www.w3.org/1999/xhtml"><body>ok</body></html>'
    expect(browserDocumentHtml("application/xhtml+xml", xhtml)).toBe(xhtml)
  })

  test("falls back to the rendered DOM when no body was captured", () => {
    expect(browserDocumentHtml("text/plain", viewerShell("shell only"))).toBe(viewerShell("shell only"))
  })

  test("returns nothing for binary content", () => {
    expect(browserDocumentHtml("image/png", viewerShell("binary"), Buffer.from([1, 2, 3]))).toBe("")
  })
})
