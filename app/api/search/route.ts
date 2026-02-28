import { NextResponse } from "next/server"

const PYTHON_SEARCH_URL = process.env.PYTHON_SEARCH_URL ?? "http://127.0.0.1:8000/search"

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
    const upstreamResponse = await fetch(PYTHON_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
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
  } catch {
    return NextResponse.json({ error: "Python search service unavailable" }, { status: 503 })
  }
}
