import crypto from "node:crypto"
import type { NextApiRequest } from "next"
import { getOneDriveConnectionStatus } from "./auth"
import { isAllowedAdminEmail } from "./configHelper"
import { azureTenantId } from "./msalHelpers"
import { uploadLinkUsable } from "./redis"
export const UPLOAD_ACCESS_COOKIE = "upload_access"
export const PORTAL_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 14
export const ADMIN_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 14

type PortalAccessPayload = {
  type: "portal"
  token: string
  exp: number
}

type AdminAccessPayload = {
  type: "admin"
  username: string
  exp: number
}

type AccessPayload = PortalAccessPayload | AdminAccessPayload

function getUploadAccessSecret() {
  const secret =
    process.env.UPLOAD_ACCESS_SECRET ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (secret) return secret

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing UPLOAD_ACCESS_SECRET. Add it to your Vercel environment variables."
    )
  }

  return "dev-upload-access-secret"
}

function signPayload(payload: AccessPayload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = crypto
    .createHmac("sha256", getUploadAccessSecret())
    .update(data)
    .digest("base64url")

  return `${data}.${signature}`
}

function isValidSignature(data: string, signature: string) {
  const expectedSignature = crypto
    .createHmac("sha256", getUploadAccessSecret())
    .update(data)
    .digest("base64url")

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  return (
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  )
}

function decodeAccessPayload(data: string): AccessPayload | null {
  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as AccessPayload

    if (!payload?.type || typeof payload.exp !== "number") return null
    if (payload.type === "portal" && typeof payload.token !== "string") {
      return null
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}

function readAccessPayload(
  cookieHeader: string | undefined
): AccessPayload | null {
  if (!cookieHeader) return null

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name !== UPLOAD_ACCESS_COOKIE) continue

    const value = decodeURIComponent(rest.join("="))
    const [data, signature] = value.split(".")
    if (!data || !signature) return null
    if (!isValidSignature(data, signature)) return null

    return decodeAccessPayload(data)
  }

  return null
}

function buildAccessCookieHeader(value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return `${UPLOAD_ACCESS_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`
}

export function createPortalAccessCookieHeader(token: string) {
  const payload: PortalAccessPayload = {
    type: "portal",
    token,
    exp: Math.floor(Date.now() / 1000) + PORTAL_ACCESS_MAX_AGE_SECONDS,
  }

  return buildAccessCookieHeader(
    signPayload(payload),
    PORTAL_ACCESS_MAX_AGE_SECONDS
  )
}

export function createAdminAccessCookieHeader(username: string) {
  const payload: AdminAccessPayload = {
    type: "admin",
    username,
    exp: Math.floor(Date.now() / 1000) + ADMIN_ACCESS_MAX_AGE_SECONDS,
  }

  return buildAccessCookieHeader(
    signPayload(payload),
    ADMIN_ACCESS_MAX_AGE_SECONDS
  )
}

export function clearUploadAccessCookieHeader() {
  return `${UPLOAD_ACCESS_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
}

/** Alias — admin sessions use the same signed cookie as portal access. */
export function clearAdminAccessCookieHeader() {
  return clearUploadAccessCookieHeader()
}

/**
 * Microsoft end-session URL so the next /setup login can pick another account.
 */
export function getMicrosoftLogoutUrl(postLogoutRedirectUri: string) {
  const authority = azureTenantId
    ? `https://login.microsoftonline.com/${azureTenantId}`
    : "https://login.microsoftonline.com/organizations"
  const url = new URL(`${authority}/oauth2/v2.0/logout`)
  url.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri)
  return url.toString()
}

function getPortalAccessToken(cookieHeader: string | undefined) {
  const payload = readAccessPayload(cookieHeader)
  return payload?.type === "portal" ? payload.token : null
}

export function getAdminAccessUsername(cookieHeader: string | undefined) {
  const payload = readAccessPayload(cookieHeader)
  return payload?.type === "admin" ? payload.username : null
}

/** True when the cookie is a valid admin session for an allowlisted email. */
export async function hasValidAdminAccess(
  cookieHeader: string | undefined
): Promise<boolean> {
  const username = getAdminAccessUsername(cookieHeader)
  if (!username) return false
  return isAllowedAdminEmail(username)
}

export function cookieHeaderFromStore(
  cookieStore: { getAll: () => Array<{ name: string; value: string }> }
): string {
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ")
}

export function getPortalAccessTokenFromRequest(req: {
  headers: { cookie?: string }
}) {
  return getPortalAccessToken(req.headers.cookie)
}

export async function canAccessUploadPortal(req: {
  headers: { cookie?: string }
}) {
  const status = await getOneDriveConnectionStatus()
  if (!status.connected) {
    return { allowed: true as const, connected: false as const }
  }

  if (await hasValidAdminAccess(req.headers.cookie)) {
    return { allowed: true as const, connected: true as const }
  }

  const token = getPortalAccessToken(req.headers.cookie)
  if (token && (await uploadLinkUsable(token))) {
    return { allowed: true as const, connected: true as const }
  }

  return {
    allowed: false as const,
    connected: true as const,
    loginUrl: "/api/auth/admin/login",
  }
}

export async function assertUploadPortalAccess(
  req: NextApiRequest,
  res: { status: (code: number) => { json: (body: unknown) => void } }
) {
  const access = await canAccessUploadPortal(req)
  if (access.allowed) return true

  res.status(401).json({
    error:
      "Upload access required. Use a parent link or sign in as an allowlisted admin.",
  })
  return false
}