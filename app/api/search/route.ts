import { NextResponse } from "next/server"

const PYTHON_SEARCH_URL = process.env.PYTHON_SEARCH_URL ?? "http://127.0.0.1:8000/search"
const DEFAULT_UPSTREAM_TIMEOUT_MS = 45_000

function resolveUpstreamTimeoutMs(): number {
  const raw = Number(process.env.SEARCH_UPSTREAM_TIMEOUT_MS ?? DEFAULT_UPSTREAM_TIMEOUT_MS)
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_UPSTREAM_TIMEOUT_MS
  }
  return Math.floor(raw)
}

interface SearchRequestBody {
  query?: string
}

export async function POST(request: Request) {
  let body: SearchRequestBody

  try {
    body = (await request.json()) as SearchRequestBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const query = body.query?.trim()

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), resolveUpstreamTimeoutMs())
    try {
      const upstreamResponse = await fetch(PYTHON_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
        cache: "no-store",
        signal: controller.signal,
      })

      const rawBody = await upstreamResponse.text()

      if (!upstreamResponse.ok) {
        return NextResponse.json(
          {
            error: "Python search service returned an error",
            details: rawBody,
          },
          { status: 502 }
        )
      }

      return new NextResponse(rawBody, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Python search service timeout" }, { status: 504 })
    }
    return NextResponse.json({ error: "Python search service unavailable" }, { status: 503 })
  }
}
