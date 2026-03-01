import { NextResponse } from "next/server"
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionValue,
  getAdminCookieOptions,
  isAdminAuthenticated,
  isAdminPasswordConfigured,
  isValidAdminPassword,
} from "@/lib/admin-auth"

export async function GET() {
  return NextResponse.json({
    configured: isAdminPasswordConfigured(),
    authenticated: await isAdminAuthenticated(),
  })
}

export async function POST(request: Request) {
  if (!isAdminPasswordConfigured()) {
    return NextResponse.json(
      { error: "Admin password is not configured" },
      { status: 503 }
    )
  }

  let body: { password?: string } | null = null
  try {
    body = (await request.json()) as { password?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!isValidAdminPassword(body?.password ?? "")) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionValue(), getAdminCookieOptions())
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...getAdminCookieOptions(),
    maxAge: 0,
  })
  return response
}
