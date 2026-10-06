import { normalizeHtml } from "./html"

export interface MinimalResponse {
  url(): string
  status(): number
  headers(): Record<string, string>
  allHeaders(): Promise<Record<string, string>>
  body(): Promise<Buffer | Uint8Array>
}

export interface CapturedResponse {
  body?: Uint8Array
  responseHeaders?: Record<string, string>
  contentType?: string
}

const TEXT_CONTENT_MARKERS = ["html", "xml", "json", "javascript", "ecmascript", "x-www-form-urlencoded"]

export const isTextContentType = (contentType: string): boolean => {
  const normalized = contentType.toLowerCase()
  return normalized.startsWith("text/") || TEXT_CONTENT_MARKERS.some((marker) => normalized.includes(marker))
}

export const isHtmlContentType = (contentType: string | undefined): boolean => {
  if (!contentType) return false
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase()
  return mediaType === "text/html" || mediaType === "application/xhtml+xml"
}

// Browsers wrap non-HTML text in a viewer shell, so prefer the captured raw body;
// fall back to the rendered DOM, or "" for binary.
export const browserDocumentHtml = (contentType: string | undefined, pageHtml: string, body?: Uint8Array): string => {
  if (contentType && !isTextContentType(contentType)) return ""
  if (!contentType || isHtmlContentType(contentType) || !body?.length) return normalizeHtml(pageHtml)
  return normalizeHtml(new TextDecoder("utf-8", { fatal: false }).decode(body))
}

export const captureResponse = async (response?: MinimalResponse): Promise<CapturedResponse> => {
  if (!response) return {}
  try {
    const raw = await response.body()
    const responseHeaders = await response.allHeaders()
    return {
      body: raw instanceof Uint8Array ? raw : new Uint8Array(raw),
      responseHeaders,
      contentType: responseHeaders["content-type"] ?? "application/octet-stream",
    }
  } catch {
    return {}
  }
}
