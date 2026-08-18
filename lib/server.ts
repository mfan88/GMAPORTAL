import "server-only"

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import type { NextApiRequest } from "next"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import { del, get, put } from "@vercel/blob"
import {
  type AccountInfo,
  type AuthorizationCodeRequest,
  type AuthorizationUrlRequest,
  ConfidentialClientApplication,
  PublicClientApplication,
} from "@azure/msal-node"
import * as XLSX from "xlsx"
import {
  type AppConfig,
  type OneDriveUploadResult,
  type OneDriveUploadSession,
  DEFAULT_APP_CONFIG,
  bufferTimeSeconds,
  linkExpirySeconds,
} from "@/lib/appConfig"
import { weeksFromEdcToDate } from "@/lib/age"
import {
  buildUploadFilename,
  parseRecordedDate,
} from "@/lib/uploadFilename"

export type { AppConfig, OneDriveUploadResult, OneDriveUploadSession }
export { DEFAULT_APP_CONFIG, bufferTimeSeconds, linkExpirySeconds }

// ===========================================================================
// Redis
// ===========================================================================

let redisClient: Redis | null = null

/** Shared Upstash Redis client (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN). */
export function getRedis() {
  if (!redisClient) {
    redisClient = Redis.fromEnv()
  }
  return redisClient
}

// ===========================================================================
// App config (Redis-backed overrides)
// ===========================================================================

const CONFIG_KEY = "app:config"

type AppConfigOverrides = {
  folderName?: string
  bufferTimeMs?: number
  linkExpiryTimeMs?: number
  fileDetails?: Partial<AppConfig["fileDetails"]>
  referenceSheetName?: string
  childNameColumn?: string
  edcColumn?: string
  allowedAdminEmails?: string[]
  sharePointSiteId?: string
  sharePointSiteUrl?: string
  sharePointSiteName?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined
}

/**
 * Like asNonEmptyString, but preserves an explicit "" so callers (e.g.
 * clearOneDriveConnection) can intentionally blank out a saved value.
 */
function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function asEmailList(value: unknown): string[] | undefined {
  if (typeof value === "string") {
    const emails = value
      .split(/[\n,;]+/)
      .map(normalizeEmail)
      .filter(Boolean)
    return emails.length > 0 ? [...new Set(emails)] : []
  }
  if (!Array.isArray(value)) return undefined
  const emails = value
    .filter((entry): entry is string => typeof entry === "string")
    .map(normalizeEmail)
    .filter(Boolean)
  return [...new Set(emails)]
}

function normalizeOverrides(raw: unknown): AppConfigOverrides {
  if (!isPlainObject(raw)) return {}

  const fileDetailsRaw = raw.fileDetails
  const fileDetails = isPlainObject(fileDetailsRaw)
    ? {
        maxFileCount: asPositiveNumber(fileDetailsRaw.maxFileCount),
        maxFileSizeBytes: asPositiveNumber(fileDetailsRaw.maxFileSizeBytes),
        maxSimpleFileSizeBytes: asPositiveNumber(
          fileDetailsRaw.maxSimpleFileSizeBytes
        ),
        uploadChunkSizeBytes: asPositiveNumber(
          fileDetailsRaw.uploadChunkSizeBytes
        ),
      }
    : undefined

  return {
    folderName: asNonEmptyString(raw.folderName),
    bufferTimeMs: asPositiveNumber(raw.bufferTimeMs),
    linkExpiryTimeMs: asPositiveNumber(raw.linkExpiryTimeMs),
    referenceSheetName: asNonEmptyString(raw.referenceSheetName),
    childNameColumn: asNonEmptyString(raw.childNameColumn),
    edcColumn: asNonEmptyString(raw.edcColumn),
    allowedAdminEmails: asEmailList(raw.allowedAdminEmails),
    sharePointSiteId: asOptionalString(raw.sharePointSiteId),
    sharePointSiteUrl: asOptionalString(raw.sharePointSiteUrl),
    sharePointSiteName: asOptionalString(raw.sharePointSiteName),
    fileDetails,
  }
}

function mergeConfig(overrides: AppConfigOverrides): AppConfig {
  return {
    folderName: overrides.folderName ?? DEFAULT_APP_CONFIG.folderName,
    bufferTimeMs: overrides.bufferTimeMs ?? DEFAULT_APP_CONFIG.bufferTimeMs,
    linkExpiryTimeMs:
      overrides.linkExpiryTimeMs ?? DEFAULT_APP_CONFIG.linkExpiryTimeMs,
    referenceSheetName:
      overrides.referenceSheetName ?? DEFAULT_APP_CONFIG.referenceSheetName,
    childNameColumn:
      overrides.childNameColumn ?? DEFAULT_APP_CONFIG.childNameColumn,
    edcColumn: overrides.edcColumn ?? DEFAULT_APP_CONFIG.edcColumn,
    allowedAdminEmails:
      overrides.allowedAdminEmails ?? DEFAULT_APP_CONFIG.allowedAdminEmails,
    sharePointSiteId:
      overrides.sharePointSiteId ?? DEFAULT_APP_CONFIG.sharePointSiteId,
    sharePointSiteUrl:
      overrides.sharePointSiteUrl ?? DEFAULT_APP_CONFIG.sharePointSiteUrl,
    sharePointSiteName:
      overrides.sharePointSiteName ?? DEFAULT_APP_CONFIG.sharePointSiteName,
    acceptedUploadTypes: DEFAULT_APP_CONFIG.acceptedUploadTypes,
    fileDetails: {
      ...DEFAULT_APP_CONFIG.fileDetails,
      ...Object.fromEntries(
        Object.entries(overrides.fileDetails ?? {}).filter(
          ([, value]) => value !== undefined
        )
      ),
    },
  }
}

/** Effective config: Redis overrides merged over code defaults. */
export async function getAppConfig(): Promise<AppConfig> {
  try {
    const raw = await getRedis().get<unknown>(CONFIG_KEY)
    const merged = mergeConfig(normalizeOverrides(raw))
    return {
      ...merged,
      allowedAdminEmails: [
        ...new Set([
          ...merged.allowedAdminEmails.map(normalizeEmail),
          ...envAllowedAdminEmails(),
        ]),
      ],
    }
  } catch {
    return {
      ...DEFAULT_APP_CONFIG,
      fileDetails: { ...DEFAULT_APP_CONFIG.fileDetails },
      allowedAdminEmails: envAllowedAdminEmails(),
    }
  }
}

export async function updateAppConfig(
  patch: AppConfigOverrides
): Promise<AppConfig> {
  const redis = getRedis()
  const existing = normalizeOverrides(await redis.get<unknown>(CONFIG_KEY))
  const next: AppConfigOverrides = {
    folderName: patch.folderName ?? existing.folderName,
    bufferTimeMs: patch.bufferTimeMs ?? existing.bufferTimeMs,
    linkExpiryTimeMs: patch.linkExpiryTimeMs ?? existing.linkExpiryTimeMs,
    referenceSheetName: patch.referenceSheetName ?? existing.referenceSheetName,
    childNameColumn: patch.childNameColumn ?? existing.childNameColumn,
    edcColumn: patch.edcColumn ?? existing.edcColumn,
    allowedAdminEmails:
      patch.allowedAdminEmails ?? existing.allowedAdminEmails,
    sharePointSiteId: patch.sharePointSiteId ?? existing.sharePointSiteId,
    sharePointSiteUrl: patch.sharePointSiteUrl ?? existing.sharePointSiteUrl,
    sharePointSiteName:
      patch.sharePointSiteName ?? existing.sharePointSiteName,
    fileDetails: {
      ...existing.fileDetails,
      ...patch.fileDetails,
    },
  }

  await redis.set(CONFIG_KEY, next)
  return mergeConfig(next)
}

export async function resetAppConfig(): Promise<AppConfig> {
  await getRedis().del(CONFIG_KEY)
  return {
    ...DEFAULT_APP_CONFIG,
    fileDetails: { ...DEFAULT_APP_CONFIG.fileDetails },
    allowedAdminEmails: [...DEFAULT_APP_CONFIG.allowedAdminEmails],
  }
}

function envAllowedAdminEmails(): string[] {
  return asEmailList(process.env.ALLOWED_ADMIN_EMAILS) ?? []
}

/** Effective admin allowlist (Settings + ALLOWED_ADMIN_EMAILS env). */
export async function getAllowedAdminEmails(): Promise<string[]> {
  const config = await getAppConfig()
  return config.allowedAdminEmails.map(normalizeEmail)
}

export async function isAllowedAdminEmail(
  email: string | null | undefined
): Promise<boolean> {
  const normalized = typeof email === "string" ? normalizeEmail(email) : ""
  if (!normalized) return false
  const allowed = await getAllowedAdminEmails()
  if (allowed.length === 0) return false
  return allowed.includes(normalized)
}

async function adminAllowlistRejectionReason(
  email: string | null | undefined
): Promise<"no_admins_configured" | "unauthorized_admin" | null> {
  const allowed = await getAllowedAdminEmails()
  if (allowed.length === 0) return "no_admins_configured"
  const normalized = typeof email === "string" ? normalizeEmail(email) : ""
  if (!normalized || !allowed.includes(normalized)) {
    return "unauthorized_admin"
  }
  return null
}

// ===========================================================================
// Upload links (Redis)
// ===========================================================================

const LINK_PREFIX = "link:"

/**
 * Link lifecycle in the admin console:
 * - "scheduled": letter date not reached yet (portal shows expired/not found).
 * - "provisioning": buffer window after the letter date (not usable yet).
 * - "pending": active and waiting for a parent to upload.
 * - "used": consumed by a successful upload; kept until admin dismisses it.
 */
export type LinkState = "scheduled" | "provisioning" | "pending" | "used"

export type UploadLink = {
  token: string
  createdAt: number
  usedAt: number | null
  state: LinkState
  childName: string | null
  /** ISO date (YYYY-MM-DD) used to compute age at upload from date recorded. */
  edc: string | null
  /**
   * When the activation buffer begins (ms). Defaults to createdAt when the
   * letter was not scheduled ahead.
   */
  bufferStartsAt: number
  /** Earliest time the parent may upload (bufferStartsAt + buffer). */
  availableAt: number
  /** Latest time the parent may upload (set when the link is created). */
  expiresAt: number
  /** ISO date (YYYY-MM-DD) when a letter was scheduled, if any. */
  scheduledDate: string | null
}

type StoredLink = {
  createdAt: number
  usedAt?: number
  childName?: string
  edc?: string
  /** Absolute expiry timestamp (ms). Older links may omit this. */
  expiresAt?: number
  /**
   * When the buffer countdown begins (ms). Older links omit this and use
   * createdAt.
   */
  bufferStartsAt?: number
  /** ISO date (YYYY-MM-DD) chosen when scheduling the letter. */
  scheduledDate?: string
  /** @deprecated Older links stored age at generation; prefer `edc`. */
  ageWeeks?: number
}

function resolveBufferStartsAt(value: StoredLink): number {
  if (
    typeof value.bufferStartsAt === "number" &&
    Number.isFinite(value.bufferStartsAt)
  ) {
    return value.bufferStartsAt
  }
  return value.createdAt
}

function startOfUtcDayFromIsoDate(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0)
}

function deriveState(
  value: StoredLink,
  bufferTimeMs: number,
  linkExpiryTimeMs: number
): LinkState {
  if (typeof value.usedAt === "number") return "used"

  const bufferStartsAt = resolveBufferStartsAt(value)
  const availableAt = bufferStartsAt + bufferTimeMs
  const expiresAt =
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)
      ? value.expiresAt
      : availableAt + linkExpiryTimeMs
  const now = Date.now()

  if (now >= expiresAt) return "used"
  if (now < bufferStartsAt) return "scheduled"
  if (now < availableAt) return "provisioning"
  return "pending"
}

function parseStoredEdc(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Prefer normalizing to YYYY-MM-DD when parseable.
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (isoMatch) return trimmed
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toUploadLink(
  token: string,
  value: StoredLink,
  bufferTimeMs: number,
  linkExpiryTimeMs: number
): UploadLink {
  const bufferStartsAt = resolveBufferStartsAt(value)
  const availableAt = bufferStartsAt + bufferTimeMs
  const expiresAt =
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)
      ? value.expiresAt
      : availableAt + linkExpiryTimeMs

  return {
    token,
    createdAt: value.createdAt,
    usedAt: value.usedAt ?? null,
    state: deriveState(value, bufferTimeMs, linkExpiryTimeMs),
    childName:
      typeof value.childName === "string" && value.childName.trim()
        ? value.childName.trim()
        : null,
    edc: parseStoredEdc(value.edc),
    bufferStartsAt,
    availableAt,
    expiresAt,
    scheduledDate: parseStoredEdc(value.scheduledDate),
  }
}

export async function createUploadLink(input: {
  childName: string
  edc: string
  /** Optional ISO date (YYYY-MM-DD). Buffer begins at UTC midnight that day. */
  scheduledDate?: string | null
}): Promise<UploadLink> {
  const childName = input.childName.trim()
  const edc = parseStoredEdc(input.edc)
  if (!childName) {
    throw new Error("A child name is required to generate a link.")
  }
  if (!edc) {
    throw new Error("A valid EDC date is required to generate a link.")
  }

  const scheduledDate = input.scheduledDate
    ? parseStoredEdc(input.scheduledDate)
    : null
  let bufferStartsAt = Date.now()
  if (scheduledDate) {
    const start = startOfUtcDayFromIsoDate(scheduledDate)
    if (start === null) {
      throw new Error("A valid letter schedule date is required.")
    }
    bufferStartsAt = start
  }

  const config = await getAppConfig()
  const token = randomUUID()
  const createdAt = Date.now()
  const availableAt = bufferStartsAt + config.bufferTimeMs
  const expiresAt = availableAt + config.linkExpiryTimeMs
  const value: StoredLink = {
    createdAt,
    childName,
    edc,
    bufferStartsAt,
    expiresAt,
    ...(scheduledDate ? { scheduledDate } : {}),
  }

  const ttlSeconds = Math.max(
    60,
    Math.ceil((expiresAt - Date.now()) / 1000)
  )

  await getRedis().set(`${LINK_PREFIX}${token}`, value, {
    ex: ttlSeconds,
  })

  return toUploadLink(
    token,
    value,
    config.bufferTimeMs,
    config.linkExpiryTimeMs
  )
}

export async function listLinks(): Promise<UploadLink[]> {
  const redis = getRedis()
  const { bufferTimeMs, linkExpiryTimeMs } = await getAppConfig()

  const tokens: string[] = []
  let cursor = "0"
  do {
    const [next, keys] = await redis.scan(cursor, {
      match: `${LINK_PREFIX}*`,
      count: 100,
    })
    cursor = String(next)
    for (const key of keys) {
      tokens.push(key.slice(LINK_PREFIX.length))
    }
  } while (cursor !== "0")

  if (tokens.length === 0) return []

  const values = await redis.mget<Array<StoredLink | null>>(
    ...tokens.map((token) => `${LINK_PREFIX}${token}`)
  )

  const links: UploadLink[] = []
  tokens.forEach((token, index) => {
    const value = values[index]
    if (value && typeof value.createdAt === "number") {
      links.push(toUploadLink(token, value, bufferTimeMs, linkExpiryTimeMs))
    }
  })

  return links.sort((a, b) => b.createdAt - a.createdAt)
}

export async function removeUploadLink(token: string): Promise<void> {
  await getRedis().del(`${LINK_PREFIX}${token}`)
}

export type LinkStatus =
  | { status: "active" }
  | { status: "expired" }
  | { status: "pending"; availableAt: number }

export async function checkUploadLink(token: string): Promise<LinkStatus> {
  const value = await getRedis().get<StoredLink>(`${LINK_PREFIX}${token}`)
  if (!value || typeof value.createdAt !== "number") {
    return { status: "expired" }
  }

  if (typeof value.usedAt === "number") {
    return { status: "expired" }
  }

  const { bufferTimeMs, linkExpiryTimeMs } = await getAppConfig()
  const bufferStartsAt = resolveBufferStartsAt(value)
  const availableAt = bufferStartsAt + bufferTimeMs
  const expiresAt =
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)
      ? value.expiresAt
      : availableAt + linkExpiryTimeMs
  const now = Date.now()

  // Before the scheduled letter date: same as not found / expired (no countdown).
  if (now < bufferStartsAt) {
    return { status: "expired" }
  }

  if (now < availableAt) {
    return { status: "pending", availableAt }
  }

  if (now >= expiresAt) {
    return { status: "expired" }
  }

  return { status: "active" }
}

export async function getUploadLink(token: string): Promise<UploadLink | null> {
  const value = await getRedis().get<StoredLink>(`${LINK_PREFIX}${token}`)
  if (!value || typeof value.createdAt !== "number") return null
  const { bufferTimeMs, linkExpiryTimeMs } = await getAppConfig()
  return toUploadLink(token, value, bufferTimeMs, linkExpiryTimeMs)
}

export async function uploadLinkUsable(token: string): Promise<boolean> {
  const value = await getRedis().get<StoredLink>(`${LINK_PREFIX}${token}`)
  if (
    !value ||
    typeof value.createdAt !== "number" ||
    typeof value.usedAt === "number"
  ) {
    return false
  }

  const { bufferTimeMs, linkExpiryTimeMs } = await getAppConfig()
  const bufferStartsAt = resolveBufferStartsAt(value)
  const availableAt = bufferStartsAt + bufferTimeMs
  const expiresAt =
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)
      ? value.expiresAt
      : availableAt + linkExpiryTimeMs
  const now = Date.now()
  return now >= availableAt && now < expiresAt
}

export async function consumeUploadLink(token: string): Promise<boolean> {
  const redis = getRedis()
  const key = `${LINK_PREFIX}${token}`

  const value = await redis.get<StoredLink>(key)
  if (
    !value ||
    typeof value.createdAt !== "number" ||
    typeof value.usedAt === "number"
  ) {
    return false
  }

  const updated: StoredLink = {
    ...value,
    usedAt: Date.now(),
  }
  await redis.set(key, updated)
  return true
}

// ===========================================================================
// Request shape
// ===========================================================================

export function toRequestShape(request: NextRequest) {
  return {
    headers: {
      host: request.headers.get("host") ?? undefined,
      "x-forwarded-host":
        request.headers.get("x-forwarded-host") ?? undefined,
      "x-forwarded-proto":
        request.headers.get("x-forwarded-proto") ?? undefined,
      cookie: request.headers.get("cookie") ?? undefined,
    },
  }
}

/**
 * Build an absolute public URL. Never use `request.url` as the base behind
 * Cloudways/nginx — Next often sees http(s)://localhost:PORT internally.
 */
export function publicUrl(path: string, request: NextRequest): URL {
  const origin = getAppOrigin(toRequestShape(request))
  return new URL(path, `${origin}/`)
}

// ===========================================================================
// PKCE / auth-flow cookies
// ===========================================================================

export function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url")
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url")

  return { verifier, challenge }
}

export const PKCE_COOKIE_NAME = "onedrive_pkce"
export const AUTH_FLOW_COOKIE_NAME = "onedrive_auth_flow"

export type OneDriveAuthFlow = "setup" | "upload-access" | "admin" | "site-grant"

function buildCookie(name: string, value: string, maxAgeSeconds: number) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`
}

function clearCookie(name: string) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
}

export function pkceCookieHeader(verifier: string) {
  return buildCookie(PKCE_COOKIE_NAME, encodeURIComponent(verifier), 600)
}

export function clearPkceCookieHeader() {
  return clearCookie(PKCE_COOKIE_NAME)
}

export function authFlowCookieHeader(flow: OneDriveAuthFlow) {
  return buildCookie(AUTH_FLOW_COOKIE_NAME, flow, 600)
}

export function clearAuthFlowCookieHeader() {
  return clearCookie(AUTH_FLOW_COOKIE_NAME)
}

export function setPkceCookie(
  res: { setHeader: (name: string, value: string) => void },
  verifier: string
) {
  res.setHeader("Set-Cookie", pkceCookieHeader(verifier))
}

export function setAuthFlowCookie(
  res: { setHeader: (name: string, value: string | string[]) => void },
  flow: OneDriveAuthFlow
) {
  res.setHeader("Set-Cookie", authFlowCookieHeader(flow))
}

export function clearPkceCookie(res: {
  setHeader: (name: string, value: string) => void
}) {
  res.setHeader("Set-Cookie", clearPkceCookieHeader())
}

export function getPkceCookie(req: { headers: { cookie?: string } }) {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === PKCE_COOKIE_NAME) {
      return decodeURIComponent(rest.join("="))
    }
  }

  return null
}

export function getAuthFlowCookie(req: {
  headers: { cookie?: string }
}): OneDriveAuthFlow | null {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === AUTH_FLOW_COOKIE_NAME) {
      const value = rest.join("=")
      if (
        value === "setup" ||
        value === "upload-access" ||
        value === "admin" ||
        value === "site-grant"
      ) {
        return value
      }
    }
  }

  return null
}

// ===========================================================================
// Server MSAL / URL helpers
// ===========================================================================

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

type ServerMsalClient =
  | ConfidentialClientApplication
  | PublicClientApplication

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

// ===========================================================================
// OneDrive token cache (Blob or local file)
// ===========================================================================

const BLOB_PATHNAME = "onedrive/token-cache.json"

export function usesBlobTokenStore() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)
}

export function getBlobAuthMode(): "oidc" | "token" | "none" {
  if (process.env.BLOB_STORE_ID) return "oidc"
  if (process.env.BLOB_READ_WRITE_TOKEN) return "token"
  return "none"
}

export function getFileTokenCachePath() {
  if (process.env.ONEDRIVE_CACHE_PATH) {
    return process.env.ONEDRIVE_CACHE_PATH
  }

  if (process.env.VERCEL) {
    return "/tmp/onedrive-cache.json"
  }

  return path.join(process.cwd(), ".data", "onedrive-cache.json")
}

export async function readTokenCache(): Promise<string | null> {
  if (usesBlobTokenStore()) {
    try {
      const result = await get(BLOB_PATHNAME, { access: "private" })
      if (result?.statusCode !== 200 || !result.stream) {
        return null
      }
      return await new Response(result.stream).text()
    } catch {
      return null
    }
  }

  const filePath = getFileTokenCachePath()
  if (!fs.existsSync(filePath)) {
    return null
  }

  return fs.readFileSync(filePath, "utf8")
}

export async function writeTokenCache(serialized: string) {
  if (usesBlobTokenStore()) {
    await put(BLOB_PATHNAME, serialized, {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
    })
    return
  }

  if (process.env.VERCEL && !usesBlobTokenStore()) {
    throw new Error(
      "OneDrive tokens cannot be saved on Vercel without Blob storage. In the Vercel dashboard, create a Blob store for this project, redeploy, then connect again."
    )
  }

  const filePath = getFileTokenCachePath()
  const directory = path.dirname(filePath)
  if (directory !== "/tmp" && !fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
  fs.writeFileSync(filePath, serialized, "utf8")
}

export async function deleteTokenCache() {
  if (usesBlobTokenStore()) {
    try {
      await del(BLOB_PATHNAME)
    } catch {
      // Blob may not exist yet.
    }
    return
  }

  const filePath = getFileTokenCachePath()
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export function getTokenStorageDescription() {
  const authMode = getBlobAuthMode()
  if (authMode === "oidc") {
    return "Vercel Blob (OIDC)"
  }
  if (authMode === "token") {
    return "Vercel Blob"
  }
  if (process.env.VERCEL) {
    return "unconfigured (connect Blob store to this project and redeploy)"
  }
  return "local file"
}

// ===========================================================================
// Microsoft Graph auth (admin identity + Sites.Selected app-only)
// ===========================================================================

let identityClient: ServerMsalClient | null = null
let appOnlyClient: ConfidentialClientApplication | null = null

function ensureClientId() {
  if (!msalClientId) {
    throw new Error(
      "Missing NEXT_PUBLIC_AZURE_CLIENT_ID (or AZURE_CLIENT_ID). Set it in .env.local or your host environment."
    )
  }
}

function ensureAppOnlyCredentials() {
  ensureClientId()
  if (!msalClientSecret) {
    throw new Error(
      "Missing AZURE_CLIENT_SECRET. Required for Sites.Selected app-only SharePoint access."
    )
  }
  if (!azureTenantId) {
    throw new Error(
      "Missing AZURE_TENANT_ID. Required for org-only Sites.Selected app-only tokens."
    )
  }
}

function createIdentityMsalClient(): ServerMsalClient {
  ensureClientId()
  const auth = {
    clientId: msalClientId,
    authority: msalAuthority,
    ...(msalClientSecret ? { clientSecret: msalClientSecret } : {}),
  }
  if (msalClientSecret) {
    return new ConfidentialClientApplication({ auth })
  }
  return new PublicClientApplication({ auth })
}

function getIdentityClient() {
  if (!identityClient) {
    identityClient = createIdentityMsalClient()
  }
  return identityClient
}

function getAppOnlyClient() {
  ensureAppOnlyCredentials()
  if (!appOnlyClient) {
    appOnlyClient = new ConfidentialClientApplication({
      auth: {
        clientId: msalClientId,
        authority: `https://login.microsoftonline.com/${azureTenantId}`,
        clientSecret: msalClientSecret,
      },
    })
  }
  return appOnlyClient
}

/** @deprecated Legacy name — identity client only (no file token cache). */
export function getOneDriveClient() {
  return getIdentityClient()
}

function createServerMsalClient(_options?: { persistCache?: boolean }) {
  return createIdentityMsalClient()
}

export async function getConfiguredSharePointSiteId(): Promise<string | null> {
  const config = await getAppConfig()
  const fromConfig = config.sharePointSiteId?.trim()
  if (fromConfig) return fromConfig
  const fromEnv = process.env.SHAREPOINT_SITE_ID?.trim()
  return fromEnv || null
}

export async function getSiteDriveBaseUrl(): Promise<string> {
  const siteId = await getConfiguredSharePointSiteId()
  if (!siteId) {
    throw new Error(
      "SharePoint site is not configured. Open /setup and connect an org SharePoint site."
    )
  }
  return `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drive`
}

/**
 * App-only Graph token. Entra app needs application permission Sites.Selected
 * (admin consent) plus an explicit grant on the target site.
 */
export async function getOneDriveAccessToken() {
  const result = await getAppOnlyClient().acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  })
  if (!result?.accessToken) {
    throw new Error("Could not acquire Microsoft Graph app-only access token.")
  }
  return result.accessToken
}

type GraphSite = {
  id?: string
  displayName?: string
  webUrl?: string
  name?: string
}

function sharePointSiteApiPath(siteUrlOrId: string): string {
  const trimmed = siteUrlOrId.trim().replace(/\/$/, "")
  if (!trimmed) {
    throw new Error("A SharePoint site URL or site id is required.")
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(trimmed)}`
  }

  const url = new URL(trimmed)
  const pathname = url.pathname.replace(/\/$/, "") || "/"
  return `https://graph.microsoft.com/v1.0/sites/${url.hostname}:${pathname}`
}

export async function resolveSharePointSite(siteUrlOrId: string): Promise<{
  siteId: string
  siteUrl: string
  siteName: string
}> {
  const accessToken = await getOneDriveAccessToken()
  const api = sharePointSiteApiPath(siteUrlOrId)
  const site = await fetchGraphJson<GraphSite>(api, accessToken)
  if (!site.id) {
    throw new Error("SharePoint site lookup did not return a site id.")
  }
  return {
    siteId: site.id,
    siteUrl: site.webUrl?.trim() || siteUrlOrId.trim(),
    siteName:
      site.displayName?.trim() ||
      site.name?.trim() ||
      site.webUrl?.trim() ||
      site.id,
  }
}

export async function connectSharePointSite(siteUrlOrId: string) {
  const resolved = await resolveSharePointSite(siteUrlOrId)
  const accessToken = await getOneDriveAccessToken()
  await fetchGraphJson<{ id?: string }>(
    `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(resolved.siteId)}/drive?$select=id,webUrl`,
    accessToken
  )
  await updateAppConfig({
    sharePointSiteId: resolved.siteId,
    sharePointSiteUrl: resolved.siteUrl,
    sharePointSiteName: resolved.siteName,
  })
  return resolved
}

export async function getConnectedOneDriveAccount(): Promise<AccountInfo | null> {
  return null
}

export function oneDriveAccountsMatch(
  signedIn: AccountInfo,
  connected: AccountInfo
) {
  if (
    signedIn.homeAccountId &&
    connected.homeAccountId &&
    signedIn.homeAccountId === connected.homeAccountId
  ) {
    return true
  }

  if (
    signedIn.localAccountId &&
    connected.localAccountId &&
    signedIn.localAccountId === connected.localAccountId
  ) {
    return true
  }

  const signedInUsername = signedIn.username?.trim().toLowerCase()
  const connectedUsername = connected.username?.trim().toLowerCase()

  return Boolean(
    signedInUsername &&
      connectedUsername &&
      signedInUsername === connectedUsername
  )
}

export async function getOneDriveConnectionStatus() {
  const config = await getAppConfig()
  const siteId =
    config.sharePointSiteId?.trim() ||
    process.env.SHAREPOINT_SITE_ID?.trim() ||
    ""
  const siteUrl =
    config.sharePointSiteUrl?.trim() ||
    process.env.SHAREPOINT_SITE_URL?.trim() ||
    ""
  const siteName = config.sharePointSiteName?.trim() || ""

  if (!siteId && !siteUrl) {
    return {
      connected: false,
      username: null as string | null,
      siteId: null as string | null,
      siteUrl: null as string | null,
      siteName: null as string | null,
      writeAccess: false as boolean,
    }
  }

  try {
    if (siteId) {
      const accessToken = await getOneDriveAccessToken()
      const site = await fetchGraphJson<GraphSite>(
        `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}?$select=id,displayName,webUrl,name`,
        accessToken
      )
      const name =
        site.displayName?.trim() ||
        site.name?.trim() ||
        site.webUrl?.trim() ||
        siteName ||
        siteId
      const writeAccess = await probeSharePointWriteAccess()
      return {
        connected: true,
        username: name,
        siteId: site.id ?? siteId,
        siteUrl: site.webUrl?.trim() || siteUrl || null,
        siteName: name,
        writeAccess,
      }
    }

    const resolved = await resolveSharePointSite(siteUrl)
    const writeAccess = await probeSharePointWriteAccess()
    return {
      connected: true,
      username: resolved.siteName,
      siteId: resolved.siteId,
      siteUrl: resolved.siteUrl,
      siteName: resolved.siteName,
      writeAccess,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      connected: false,
      username: null as string | null,
      siteId: siteId || null,
      siteUrl: siteUrl || null,
      siteName: siteName || null,
      writeAccess: false as boolean,
      error: message,
    }
  }
}

export async function getOneDriveLoginUrl(
  codeChallenge: string,
  req?: {
    headers: {
      host?: string
      "x-forwarded-proto"?: string | string[]
    }
  }
) {
  const client = getIdentityClient()
  const request: AuthorizationUrlRequest = {
    scopes: [...identityScopes],
    redirectUri: getOneDriveRedirectUri(req),
    prompt: "select_account",
    codeChallenge,
    codeChallengeMethod: "S256",
  }
  return client.getAuthCodeUrl(request)
}

export async function completeOneDriveLogin(
  _code: string,
  _codeVerifier: string,
  _req?: {
    headers: {
      host?: string
      "x-forwarded-proto"?: string | string[]
    }
  }
) {
  throw new Error(
    "Receiving destination is a SharePoint site (Sites.Selected), not a user OneDrive login."
  )
}

export async function clearOneDriveConnection() {
  await updateAppConfig({
    sharePointSiteId: "",
    sharePointSiteUrl: "",
    sharePointSiteName: "",
  })
  await deleteTokenCache().catch(() => undefined)
  identityClient = null
  appOnlyClient = null
}

export async function getUploadAccessLoginUrl(
  codeChallenge: string,
  req?: {
    headers: {
      host?: string
      "x-forwarded-proto"?: string | string[]
    }
  },
  loginHint?: string
) {
  const client = createServerMsalClient()

  const request: AuthorizationUrlRequest = {
    scopes: [...identityScopes],
    redirectUri: getUploadAccessRedirectUri(req),
    prompt: "select_account",
    codeChallenge,
    codeChallengeMethod: "S256",
    ...(loginHint ? { loginHint } : {}),
  }

  return client.getAuthCodeUrl(request)
}

export async function verifyUploadAccessIdentity(
  code: string,
  codeVerifier: string,
  req?: {
    headers: {
      host?: string
      "x-forwarded-proto"?: string | string[]
    }
  }
) {
  const client = createServerMsalClient()

  const request: AuthorizationCodeRequest = {
    code,
    codeVerifier,
    scopes: [...identityScopes],
    redirectUri: getUploadAccessRedirectUri(req),
  }

  const result = await client.acquireTokenByCode(request)
  return result.account ?? null
}

export async function getSiteGrantLoginUrl(
  codeChallenge: string,
  req?: {
    headers: {
      host?: string
      "x-forwarded-proto"?: string | string[]
    }
  }
) {
  const client = createServerMsalClient()
  const request: AuthorizationUrlRequest = {
    scopes: [...siteGrantScopes],
    redirectUri: getUploadAccessRedirectUri(req),
    // Prefer consent so Sites.FullControl.All is approved when first used.
    prompt: "select_account",
    codeChallenge,
    codeChallengeMethod: "S256",
  }
  return client.getAuthCodeUrl(request)
}

async function acquireSiteGrantToken(
  code: string,
  codeVerifier: string,
  req?: {
    headers: {
      host?: string
      "x-forwarded-proto"?: string | string[]
    }
  }
) {
  const client = createServerMsalClient()
  const request: AuthorizationCodeRequest = {
    code,
    codeVerifier,
    scopes: [...siteGrantScopes],
    redirectUri: getUploadAccessRedirectUri(req),
  }
  return client.acquireTokenByCode(request)
}

/**
 * Uses a short-lived admin delegated token to grant this app write on the site.
 * Does not store the admin FullControl token.
 */
export async function grantSharePointAppWriteAccess(
  adminAccessToken: string,
  siteId: string
) {
  ensureClientId()
  const displayName =
    process.env.AZURE_APP_DISPLAY_NAME?.trim() || "GMA Upload Portal"

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roles: ["write"],
        grantedToIdentities: [
          {
            application: {
              id: msalClientId,
              displayName,
            },
          },
        ],
      }),
    }
  )

  if (res.ok) return

  const details = await res.text()
  // Already granted is fine — treat as success when the message indicates conflict.
  if (
    res.status === 409 ||
    /already exists|permission.*exist/i.test(details)
  ) {
    return
  }

  throw new Error(
    `Could not grant app write on the SharePoint site (${res.status}): ${
      details || res.statusText
    }. Sign in as a SharePoint/Global admin, and ensure the Entra app has delegated Sites.FullControl.All with admin consent.`
  )
}

/** True when app-only Sites.Selected can create an upload session (needs write). */
export async function probeSharePointWriteAccess(): Promise<boolean> {
  try {
    const accessToken = await getOneDriveAccessToken()
    const driveBase = await getSiteDriveBaseUrl()
    const res = await fetch(
      `${driveBase}/root:/gma-write-probe.tmp:/createUploadSession`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: {
            "@microsoft.graph.conflictBehavior": "replace",
            name: "gma-write-probe.tmp",
          },
        }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

// ===========================================================================
// Upload / admin access cookies
// ===========================================================================

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

// ===========================================================================
// Graph / OneDrive file upload helpers
// ===========================================================================

function encodeDrivePath(drivePath: string) {
  return drivePath.split("/").map(encodeURIComponent).join("/")
}

export async function buildDriveItemPath(filename: string) {
  const { folderName } = await getAppConfig()
  return `${folderName}/${filename}`
}

export function sanitizeUploadFilename(filename: string) {
  const base = filename.split(/[/\\]/).pop()?.trim()
  if (!base) {
    throw new Error("A valid filename is required.")
  }
  return base
}

/**
 * Build the OneDrive filename from the portal link's child name + EDC and the
 * parent-selected date recorded. Age is weeks from EDC → date recorded.
 */
export async function resolvePortalUploadFilename(
  req: { headers: { cookie?: string } },
  dateRecordedRaw: string,
  originalFilename: string
): Promise<string> {
  const token = getPortalAccessTokenFromRequest(req)
  if (!token) {
    throw new Error(
      "A parent upload link is required before a file can be named and uploaded."
    )
  }

  const link = await getUploadLink(token)
  if (!link || link.state === "used") {
    throw new Error("This upload link is no longer valid.")
  }
  if (!link.childName) {
    throw new Error("This upload link is missing a child name.")
  }
  if (!link.edc) {
    throw new Error(
      "This upload link is missing an EDC date. Ask the clinic for a new link."
    )
  }

  const dateRecorded = parseRecordedDate(dateRecordedRaw)
  if (!dateRecorded) {
    throw new Error("A valid date recorded is required.")
  }

  const ageWeeks = weeksFromEdcToDate(link.edc, dateRecorded)
  if (ageWeeks === null) {
    throw new Error("Could not calculate age from EDC and the date recorded.")
  }

  return buildUploadFilename(
    sanitizeUploadFilename(originalFilename),
    dateRecorded,
    link.childName,
    ageWeeks
  )
}

export async function assertValidUploadSize(fileSize: number) {
  const {
    fileDetails: { maxFileSizeBytes },
  } = await getAppConfig()

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("File size is required.")
  }
  if (fileSize > maxFileSizeBytes) {
    throw new Error(
      `Files must be ${maxFileSizeBytes / (1024 * 1024)} MB or smaller.`
    )
  }
}

async function parseGraphError(res: Response) {
  const details = await res.text()
  if (details.includes("SPO license")) {
    throw new Error(
      "This Microsoft account cannot write to SharePoint (missing license). Use an org site the app can access."
    )
  }
  if (res.status === 403 || /accessDenied/i.test(details)) {
    throw new Error(
      "SharePoint access denied (403). In Entra, grant application Sites.Selected + admin consent, then grant this app the write role on the target site via Graph POST /sites/{siteId}/permissions. Connecting the site only verifies the site exists — uploads need an explicit site write grant."
    )
  }
  throw new Error(
    `Upload failed (${res.status}): ${details || res.statusText}`
  )
}

export async function uploadSmallFileToOneDrive(
  file: File,
  accessToken: string
): Promise<OneDriveUploadResult> {
  const {
    fileDetails: { maxSimpleFileSizeBytes },
  } = await getAppConfig()

  if (file.size > maxSimpleFileSizeBytes) {
    throw new Error(
      `Use a resumable upload session for files over ${maxSimpleFileSizeBytes / (1024 * 1024)} MB.`
    )
  }

  const driveItemPath = await buildDriveItemPath(file.name)
  const encodedPath = encodeDrivePath(driveItemPath)
  const driveBase = await getSiteDriveBaseUrl()
  const res = await fetch(
    `${driveBase}/root:/${encodedPath}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    }
  )

  if (!res.ok) {
    await parseGraphError(res)
  }

  const item = (await res.json()) as OneDriveUploadResult
  if (!item.webUrl) {
    throw new Error("Upload succeeded but OneDrive did not return a file URL.")
  }

  return item
}

export async function createOneDriveUploadSession(
  accessToken: string,
  filename: string
): Promise<OneDriveUploadSession> {
  const driveItemPath = await buildDriveItemPath(filename)
  const encodedPath = encodeDrivePath(driveItemPath)
  const driveBase = await getSiteDriveBaseUrl()
  const res = await fetch(
    `${driveBase}/root:/${encodedPath}:/createUploadSession`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": "rename",
          name: filename,
        },
      }),
    }
  )

  if (!res.ok) {
    await parseGraphError(res)
  }

  const session = (await res.json()) as OneDriveUploadSession
  if (!session.uploadUrl) {
    throw new Error("OneDrive did not return an upload session URL.")
  }

  return session
}

// ===========================================================================
// OneDrive browsing (settings)
// ===========================================================================

export type DriveFolderOption = {
  id: string
  name: string
}

export type DriveWorkbookOption = {
  id: string
  name: string
}

type GraphDriveItem = {
  id?: string
  name?: string
  folder?: Record<string, unknown>
  file?: Record<string, unknown>
}

async function fetchGraphJson<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!res.ok) {
    await parseGraphError(res)
  }
  return (await res.json()) as T
}

/** Top-level folders under the connected SharePoint site drive root. */
export async function listOneDriveRootFolders(
  accessToken: string
): Promise<DriveFolderOption[]> {
  const driveBase = await getSiteDriveBaseUrl()
  const data = await fetchGraphJson<{ value?: GraphDriveItem[] }>(
    `${driveBase}/root/children?$select=id,name,folder&$top=200`,
    accessToken
  )

  return (data.value ?? [])
    .filter((item) => item.folder && typeof item.name === "string" && item.id)
    .map((item) => ({ id: item.id as string, name: item.name as string }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

type GraphChildrenPage = {
  value?: GraphDriveItem[]
  "@odata.nextLink"?: string
}

async function listDriveChildrenPage(
  url: string,
  accessToken: string
): Promise<GraphChildrenPage> {
  return fetchGraphJson<GraphChildrenPage>(url, accessToken)
}

/**
 * All .xlsx workbooks under the connected SharePoint site drive, found by
 * walking folders. Prefer this over Graph search — search is index-based and
 * often misses newly uploaded files for minutes (or longer).
 */
export async function listOneDriveWorkbooks(
  accessToken: string
): Promise<DriveWorkbookOption[]> {
  const MAX_WORKBOOKS = 200
  const MAX_FOLDERS = 300
  const driveBase = await getSiteDriveBaseUrl()

  const seenNames = new Set<string>()
  const workbooks: DriveWorkbookOption[] = []
  const folderQueue: string[] = ["root"]
  const visitedFolders = new Set<string>()

  while (folderQueue.length > 0 && workbooks.length < MAX_WORKBOOKS) {
    if (visitedFolders.size >= MAX_FOLDERS) break

    const folderId = folderQueue.shift()
    if (!folderId || visitedFolders.has(folderId)) continue
    visitedFolders.add(folderId)

    const childrenPath =
      folderId === "root"
        ? `${driveBase}/root/children`
        : `${driveBase}/items/${folderId}/children`

    let nextUrl: string | undefined =
      `${childrenPath}?$select=id,name,file,folder&$top=200`

    while (nextUrl && workbooks.length < MAX_WORKBOOKS) {
      const page = await listDriveChildrenPage(nextUrl, accessToken)

      for (const item of page.value ?? []) {
        if (typeof item.id !== "string" || typeof item.name !== "string") {
          continue
        }

        if (item.folder) {
          if (
            !visitedFolders.has(item.id) &&
            visitedFolders.size + folderQueue.length < MAX_FOLDERS
          ) {
            folderQueue.push(item.id)
          }
          continue
        }

        if (!item.file) continue
        if (!item.name.toLowerCase().endsWith(".xlsx")) continue
        if (seenNames.has(item.name)) continue

        seenNames.add(item.name)
        workbooks.push({ id: item.id, name: item.name })
        if (workbooks.length >= MAX_WORKBOOKS) break
      }

      nextUrl = page["@odata.nextLink"]
    }
  }

  return workbooks.sort((a, b) => a.name.localeCompare(b.name))
}

async function findOneDriveWorkbookByName(
  accessToken: string,
  filename: string
): Promise<DriveWorkbookOption | null> {
  const target = filename.trim().toLowerCase()
  if (!target) return null

  const workbooks = await listOneDriveWorkbooks(accessToken)
  return (
    workbooks.find((workbook) => workbook.name.toLowerCase() === target) ??
    null
  )
}

function columnLetterToIndex(letter: string): number | null {
  // Excel columns are A..XFD (at most 3 letters). Longer strings like "Name"
  // must be treated as header labels, not column letters.
  const trimmed = letter.trim().toUpperCase()
  if (!/^[A-Z]{1,3}$/.test(trimmed)) return null

  let index = 0
  for (const char of trimmed) {
    index = index * 26 + (char.codePointAt(0)! - 64)
  }
  return index - 1
}

function cellToDisplayString(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim()
  }
  return ""
}

function resolveColumnIndex(
  headerRow: unknown[],
  columnSpec: string,
  columnLabel = "Column"
): number {
  const target = columnSpec.trim()
  if (!target) {
    throw new Error(`${columnLabel} is not configured.`)
  }

  // Prefer matching the first-row header text so values like "Name" / "EDC"
  // are never misread as Excel column letters.
  const headerIndex = headerRow.findIndex(
    (cell) => cellToDisplayString(cell).toLowerCase() === target.toLowerCase()
  )
  if (headerIndex !== -1) return headerIndex

  const letterIndex = columnLetterToIndex(target)
  if (letterIndex !== null) {
    return letterIndex
  }

  throw new Error(
    `Could not find column "${columnSpec}" in the first row of the reference workbook.`
  )
}

function parseWorkbookDate(value: unknown): string | null {
  if (value == null || value === "") return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString().slice(0, 10)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const date = new Date(trimmed)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString().slice(0, 10)
  }

  return null
}

export type ReferenceChild = {
  name: string
  /** ISO date (YYYY-MM-DD) from the EDC column, when parseable. */
  edc: string | null
}

/**
 * Children from the configured reference workbook (name + EDC),
 * in sheet order (first occurrence kept if duplicate names).
 */
export async function listChildNamesFromReferenceWorkbook(
  accessToken: string
): Promise<{
  children: ReferenceChild[]
  names: string[]
  workbookName: string
  column: string
  edcColumn: string
}> {
  const config = await getAppConfig()
  const workbookName = config.referenceSheetName.trim()
  const column = config.childNameColumn.trim()
  const edcColumn = config.edcColumn.trim()

  if (!workbookName) {
    throw new Error("Reference workbook is not configured.")
  }
  if (!column) {
    throw new Error("Child name column is not configured.")
  }
  if (!edcColumn) {
    throw new Error("EDC column is not configured.")
  }

  const workbook = await findOneDriveWorkbookByName(accessToken, workbookName)
  if (!workbook) {
    throw new Error(
      `Reference workbook "${workbookName}" was not found in the SharePoint site drive.`
    )
  }

  const driveBase = await getSiteDriveBaseUrl()
  const contentRes = await fetch(
    `${driveBase}/items/${workbook.id}/content`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      redirect: "follow",
    }
  )
  if (!contentRes.ok) {
    const details = await contentRes.text()
    throw new Error(
      `Could not download "${workbookName}" (${contentRes.status}): ${
        details || contentRes.statusText
      }`
    )
  }

  const buffer = Buffer.from(await contentRes.arrayBuffer())
  const parsed = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const firstSheetName = parsed.SheetNames[0]
  if (!firstSheetName) {
    throw new Error(`No worksheets found in "${workbookName}".`)
  }

  const sheet = parsed.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  })

  if (rows.length === 0) {
    return { children: [], names: [], workbookName, column, edcColumn }
  }

  const headerRow = (rows[0] ?? []) as unknown[]
  const nameIndex = resolveColumnIndex(headerRow, column, "Child name column")
  const edcIndex = resolveColumnIndex(headerRow, edcColumn, "EDC column")
  const seen = new Set<string>()
  const children: ReferenceChild[] = []

  for (const row of rows.slice(1)) {
    const cells = (row ?? []) as unknown[]
    const name = cellToDisplayString(cells[nameIndex])
    if (!name || seen.has(name)) continue
    seen.add(name)
    children.push({
      name,
      edc: parseWorkbookDate(cells[edcIndex]),
    })
  }

  return {
    children,
    names: children.map((child) => child.name),
    workbookName,
    column,
    edcColumn,
  }
}

// ===========================================================================
// OAuth callback handler
// ===========================================================================

function redirectWithCookies(
  request: NextRequest,
  redirectPath: string,
  cookies: string[]
) {
  const response = NextResponse.redirect(publicUrl(redirectPath, request), {
    status: 307,
  })
  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", cookie)
  }
  return response
}

type RequestShape = ReturnType<typeof toRequestShape>

const CLEAR_AUTH_COOKIES = () => [
  clearPkceCookieHeader(),
  clearAuthFlowCookieHeader(),
]

function errorRedirect(
  request: NextRequest,
  flow: string,
  reason: string
): NextResponse {
  const destination =
    flow === "upload-access" || flow === "admin"
      ? `/upload-access-denied?error=${encodeURIComponent(reason)}`
      : `/setup?error=${encodeURIComponent(reason)}`
  return redirectWithCookies(request, destination, CLEAR_AUTH_COOKIES())
}

async function completeSiteGrantFlow(
  request: NextRequest,
  shaped: RequestShape,
  code: string,
  codeVerifier: string
): Promise<NextResponse> {
  const clearCookies = CLEAR_AUTH_COOKIES()
  const result = await acquireSiteGrantToken(code, codeVerifier, shaped)
  const username = result.account?.username
  if (!username || !result.accessToken) {
    return redirectWithCookies(
      request,
      "/setup?error=missing_account",
      clearCookies
    )
  }

  const adminRejection = await adminAllowlistRejectionReason(username)
  if (adminRejection) {
    return redirectWithCookies(
      request,
      `/setup?error=${adminRejection}`,
      clearCookies
    )
  }

  const siteId = await getConfiguredSharePointSiteId()
  if (!siteId) {
    return redirectWithCookies(
      request,
      "/setup?error=site_not_connected",
      [...clearCookies, createAdminAccessCookieHeader(username)]
    )
  }

  try {
    await grantSharePointAppWriteAccess(result.accessToken, siteId)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "grant_failed"
    return redirectWithCookies(
      request,
      `/setup?error=${encodeURIComponent(message)}`,
      [...clearCookies, createAdminAccessCookieHeader(username)]
    )
  }

  return redirectWithCookies(request, "/setup?granted=1", [
    ...clearCookies,
    createAdminAccessCookieHeader(username),
  ])
}

async function completeUploadAccessFlow(
  request: NextRequest,
  shaped: RequestShape,
  code: string,
  codeVerifier: string
): Promise<NextResponse> {
  // Same gate as admin — Sites.Selected has no receiving user mailbox to match.
  return completeAdminFlow(request, shaped, code, codeVerifier)
}

async function completeAdminFlow(
  request: NextRequest,
  shaped: RequestShape,
  code: string,
  codeVerifier: string
): Promise<NextResponse> {
  const clearCookies = CLEAR_AUTH_COOKIES()

  const signedInAccount = await verifyUploadAccessIdentity(
    code,
    codeVerifier,
    shaped
  )
  if (!signedInAccount?.username) {
    return redirectWithCookies(
      request,
      "/upload-access-denied?error=missing_account",
      clearCookies
    )
  }

  const adminRejection = await adminAllowlistRejectionReason(
    signedInAccount.username
  )
  if (adminRejection) {
    return redirectWithCookies(
      request,
      `/upload-access-denied?error=${adminRejection}`,
      clearCookies
    )
  }

  return redirectWithCookies(request, "/setup", [
    ...clearCookies,
    createAdminAccessCookieHeader(signedInAccount.username),
  ])
}

async function completeSetupFlow(
  request: NextRequest,
  _shaped: RequestShape,
  _code: string,
  _codeVerifier: string
): Promise<NextResponse> {
  return redirectWithCookies(
    request,
    "/setup?error=use_sharepoint_connect",
    CLEAR_AUTH_COOKIES()
  )
}

export async function handleOneDriveOAuthCallback(request: NextRequest) {
  const shaped = toRequestShape(request)
  const flow = getAuthFlowCookie(shaped) ?? "setup"
  const params = request.nextUrl.searchParams
  const code = params.get("code")
  const error = params.get("error")

  if (error) {
    return errorRedirect(
      request,
      flow,
      params.get("error_description") ?? error
    )
  }
  if (!code) {
    return errorRedirect(request, flow, "missing_code")
  }

  const codeVerifier = getPkceCookie(shaped)
  if (!codeVerifier) {
    return errorRedirect(request, flow, "missing_pkce_verifier")
  }

  try {
    if (flow === "site-grant") {
      return await completeSiteGrantFlow(request, shaped, code, codeVerifier)
    }
    if (flow === "upload-access") {
      return await completeUploadAccessFlow(
        request,
        shaped,
        code,
        codeVerifier
      )
    }
    if (flow === "admin") {
      return await completeAdminFlow(request, shaped, code, codeVerifier)
    }
    return await completeSetupFlow(request, shaped, code, codeVerifier)
  } catch (err) {
    const raw = err instanceof Error ? err.message : "callback_failed"
    const needsSecret =
      /AADSTS70002|client_secret/i.test(raw) && !msalClientSecret
    const message = needsSecret
      ? "Missing AZURE_CLIENT_SECRET. Create a client secret in Azure App registration → Certificates & secrets, then set AZURE_CLIENT_SECRET in Vercel / .env.local and redeploy."
      : raw
    return errorRedirect(request, flow, message)
  }
}
