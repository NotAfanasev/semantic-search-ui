import { NextResponse } from "next/server"

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL ?? "http://127.0.0.1:8000"

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const docId = id?.trim()
  if (!docId) {
    return NextResponse.json({ error: "Document id is required" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const upstreamResponse = await fetch(
      `${PYTHON_API_BASE_URL}/documents/${encodeURIComponent(docId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    )

    const rawBody = await upstreamResponse.text()
    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: "Python documents service returned an error", details: rawBody },
        { status: 502 }
      )
    }

    return new NextResponse(rawBody, { status: 200, headers: jsonHeaders() })
  } catch {
    return NextResponse.json({ error: "Python documents service unavailable" }, { status: 503 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const docId = id?.trim()
  if (!docId) {
    return NextResponse.json({ error: "Document id is required" }, { status: 400 })
  }

  try {
    const upstreamResponse = await fetch(
      `${PYTHON_API_BASE_URL}/documents/${encodeURIComponent(docId)}`,
      {
        method: "DELETE",
        cache: "no-store",
      }
    )
    const rawBody = await upstreamResponse.text()

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: "Python documents service returned an error", details: rawBody },
        { status: 502 }
      )
    }

    return new NextResponse(rawBody, { status: 200, headers: jsonHeaders() })
  } catch {
    return NextResponse.json({ error: "Python documents service unavailable" }, { status: 503 })
  }
}
