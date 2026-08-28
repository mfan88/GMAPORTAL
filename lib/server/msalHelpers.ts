import {
  ConfidentialClientApplication,
  PublicClientApplication,
} from "@azure/msal-node"

export type ServerMsalClient =
  | ConfidentialClientApplication
  | PublicClientApplication

export const msalClientId =
  process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ??
  process.env.AZURE_CLIENT_ID ??
  ""

/** Required for the confidential client (app-only Sites.Selected + admin OAuth). */
export const msalClientSecret = process.env.AZURE_CLIENT_SECRET ?? ""

/** Entra tenant ID or verified domain. Required for app-only Sites.Selected tokens. */
export const azureTenantId =
  process.env.AZURE_TENANT_ID?.trim() ||
  process.env.NEXT_PUBLIC_AZURE_TENANT_ID?.trim() ||
  ""

// Org-only: this app never signs in personal Microsoft accounts and never
// uploads to a personal OneDrive, so we never fall back to /common.
export const msalAuthority = azureTenantId
  ? `https://login.microsoftonline.com/${azureTenantId}`
  : "https://login.microsoftonline.com/organizations"

/** Interactive sign-in scope for admin / upload-access identity checks only. */
export const identityScopes = ["User.Read"] as const

/**
 * One-time admin flow to grant this app write on the connected site.
 * Requires Entra delegated Sites.FullControl.All + admin consent.
 * Token is not persisted — only used to POST /sites/{id}/permissions.
 */
export const siteGrantScopes = ["User.Read", "Sites.FullControl.All"] as const

/** @deprecated Use identityScopes. Kept as an alias for older imports. */
export const graphScopes = identityScopes

/**
 * Accept only real http(s) origins. Rejects bare UUIDs / client IDs that are
 * sometimes mistakenly set as NEXT_PUBLIC_APP_URL / APP_URL.
 */
function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null
  // Strip wrapping quotes some hosts inject into env values.
  const trimmed = value.trim().replace(/^["']|["']$/g, "").replace(/\/$/, "")
  if (!trimmed) return null

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`
    const url = new URL(withProtocol)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null

    const host = url.hostname.toLowerCase()
    const looksLikeHost =
      host === "localhost" || host.includes(".") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    if (!looksLikeHost) return null

    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

function isDevRuntime() {
  return process.env.NODE_ENV !== "production"
}

function isLoopbackHost(hostname: string) {
  const host = hostname.toLowerCase()
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost")
  )
}

/**
 * Dynamic lookup so Next cannot replace NEXT_PUBLIC_* with undefined at build
 * when the var was missing during `next build`.
 */
function readRuntimeEnv(name: string): string | undefined {
  const value = process.env[name]
  return typeof value === "string" && value.trim() ? value : undefined
}

/**
 * Read configured public origin. Prefer APP_URL (runtime) over NEXT_PUBLIC_*.
 */
function configuredAppOrigin(): string | null {
  return (
    normalizeOrigin(readRuntimeEnv("APP_URL")) ??
    normalizeOrigin(readRuntimeEnv("NEXT_PUBLIC_APP_URL"))
  )
}

function missingAppUrlError() {
  return new Error(
    "Missing APP_URL (or NEXT_PUBLIC_APP_URL). Set it to your public origin, e.g. https://upload.fenna.tech, then restart/rebuild."
  )
}

function headerValue(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === "string") return value.split(",")[0]?.trim() || undefined
  if (Array.isArray(value)) return value[0]?.split(",")[0]?.trim() || undefined
  return undefined
}

type OriginRequest = {
  headers: {
    host?: string
    "x-forwarded-host"?: string | string[]
    "x-forwarded-proto"?: string | string[]
  }
}

function requestProtocol(req: OriginRequest): string {
  const forwarded = headerValue(req.headers["x-forwarded-proto"])
  if (forwarded) return forwarded

  const host =
    headerValue(req.headers["x-forwarded-host"]) ?? req.headers.host ?? ""
  return isLoopbackHost(host.split(":")[0] ?? host) ? "http" : "https"
}

function requestHost(req: OriginRequest): string | null {
  // Cloudways/nginx often sets Host to localhost and the public domain on
  // X-Forwarded-Host — prefer the forwarded host for OAuth redirects.
  const forwarded = headerValue(req.headers["x-forwarded-host"])
  if (forwarded && !isLoopbackHost(forwarded.split(":")[0] ?? forwarded)) {
    return forwarded
  }

  const host = req.headers.host
  if (!host) return null
  if (!isDevRuntime() && isLoopbackHost(host.split(":")[0] ?? host)) {
    return null
  }
  return host
}

function originFromRequest(req?: OriginRequest): string | null {
  if (!req) return null
  const host = requestHost(req)
  if (!host) return null
  return normalizeOrigin(`${requestProtocol(req)}://${host}`)
}

export function getAppOrigin(req?: OriginRequest) {
  const configured = configuredAppOrigin()
  if (configured) return configured

  const fromRequest = originFromRequest(req)
  if (fromRequest) return fromRequest

  // Outside `next dev`, never fall back to localhost — that silently breaks OAuth.
  if (!isDevRuntime()) {
    throw missingAppUrlError()
  }

  return (
    normalizeOrigin(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null
    ) ??
    normalizeOrigin(
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
    ) ??
    "http://localhost:3000"
  )
}

export function getPublicSiteOrigin(req?: OriginRequest) {
  const configured = configuredAppOrigin()
  if (configured) return configured

  const fromRequest = originFromRequest(req)
  if (fromRequest) return fromRequest

  if (!isDevRuntime()) {
    throw missingAppUrlError()
  }

  return getAppOrigin(req)
}

function resolveRedirectUri(pathName: string, req?: OriginRequest) {
  const explicit = readRuntimeEnv("ONEDRIVE_REDIRECT_URI")
  if (explicit) {
    return explicit.replace(/\/$/, "")
  }

  // 1) Env origin (APP_URL / NEXT_PUBLIC_APP_URL)
  // 2) Public forwarded host (Cloudways-safe)
  // 3) Dev localhost only
  const origin = getAppOrigin(req)
  return `${origin}${pathName}`
}

export function getOneDriveRedirectUri(req?: OriginRequest) {
  return resolveRedirectUri("/api/auth/onedrive/callback", req)
}

export function getUploadAccessRedirectUri(req?: OriginRequest) {
  return resolveRedirectUri("/api/auth/upload-access/callback", req)
}

export function getRegisteredRedirectUris(req?: OriginRequest) {
  const explicit = readRuntimeEnv("ONEDRIVE_REDIRECT_URI")
  if (explicit) {
    return [explicit.replace(/\/$/, "")]
  }

  const origin = getAppOrigin(req)
  return [
    `${origin}/api/auth/onedrive/callback`,
    `${origin}/api/auth/upload-access/callback`,
  ]
}