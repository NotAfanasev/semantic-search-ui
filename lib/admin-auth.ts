import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export const ADMIN_COOKIE_NAME = "kb_admin_session"
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? ""
}

function buildSessionValue(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex")
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function isAdminPasswordConfigured(): boolean {
  return getAdminPassword().length > 0
}

export function isValidAdminPassword(candidate: string): boolean {
  const password = getAdminPassword()
  if (!password || !candidate) return false
  return safeEqual(candidate.trim(), password)
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  }
}

export function createAdminSessionValue(): string {
  return buildSessionValue(getAdminPassword())
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!isAdminPasswordConfigured()) return false

  const cookieStore = await cookies()
  const actual = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? ""
  const expected = createAdminSessionValue()
  if (!actual || !expected) return false
  return safeEqual(actual, expected)
}

export function unauthorizedAdminResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
