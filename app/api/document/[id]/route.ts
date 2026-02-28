import { NextResponse } from "next/server"

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL ?? "http://127.0.0.1:8000"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const docId = id?.trim()

  if (!docId) {
    return NextResponse.json({ error: "Document id is required" }, { status: 400 })
  }

  const upstreamUrl = `${PYTHON_API_BASE_URL}/documents/${encodeURIComponent(docId)}`

  try {
    const upstreamResponse = await fetch(upstreamUrl, { cache: "no-store" })
    const rawBody = await upstreamResponse.text()

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          error: "Python document service returned an error",
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
    return NextResponse.json({ error: "Python document service unavailable" }, { status: 503 })
  }
}
