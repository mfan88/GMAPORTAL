import {
  type AccountInfo,
  type AuthorizationCodeRequest,
  type AuthorizationUrlRequest,
  ConfidentialClientApplication,
  PublicClientApplication,
} from "@azure/msal-node"
import { deleteTokenCache } from "./cache"
import { getAppConfig, updateAppConfig } from "./configHelper"
import {
  driveBaseFromId,
  encodeDrivePath,
  fetchGraphJson,
  getDriveItemByPath,
} from "./graph"
import {
  type ServerMsalClient,
  azureTenantId,
  getOneDriveRedirectUri,
  getUploadAccessRedirectUri,
  identityScopes,
  msalClientId,
  msalClientSecret,
  msalAuthority,
  siteGrantScopes,
} from "./msalHelpers"

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

export type GraphDrive = {
  id?: string
  name?: string
  driveType?: string
}

export async function listSiteDrives(accessToken: string): Promise<GraphDrive[]> {
  const siteId = await getConfiguredSharePointSiteId()
  if (!siteId) {
    throw new Error(
      "SharePoint site is not configured. Open /setup and connect an org SharePoint site."
    )
  }

  const drives: GraphDrive[] = []
  let nextUrl: string | undefined =
    `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drives?$select=id,name,driveType&$top=50`

  while (nextUrl) {
    const page: {
      value?: GraphDrive[]
      "@odata.nextLink"?: string
    } = await fetchGraphJson(nextUrl, accessToken)
    drives.push(...(page.value ?? []))
    nextUrl = page["@odata.nextLink"]
  }

  return drives.filter((drive) => Boolean(drive.id && drive.name))
}

function normalizeFolderPath(folderName: string) {
  return folderName.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")
}

async function findDriveFolderPath(
  drives: GraphDrive[],
  folderPath: string,
  accessToken: string
): Promise<{ driveId: string } | null> {
  for (const drive of drives) {
    if (!drive.id) continue
    try {
      const item = await getDriveItemByPath(drive.id, folderPath, accessToken)
      if (item?.id && item.folder) {
        return { driveId: drive.id }
      }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Resolve where uploads go. `folderName` may be a document library (drive)
 * name, a library-relative path like "GMA Video/Inbox", or a folder under
 * any library on the site.
 */
export async function resolveUploadLocation(filename: string): Promise<{
  driveBase: string
  itemPath: string
}> {
  const { folderName } = await getAppConfig()
  const folder = normalizeFolderPath(folderName)
  const defaultDrive = await getSiteDriveBaseUrl()

  if (!folder) {
    return { driveBase: defaultDrive, itemPath: filename }
  }

  const accessToken = await getOneDriveAccessToken()
  const drives = await listSiteDrives(accessToken)
  const slash = folder.indexOf("/")
  if (slash > 0) {
    const libraryName = folder.slice(0, slash)
    const rest = folder.slice(slash + 1)
    const library = drives.find((drive) => drive.name === libraryName)
    if (library?.id) {
      return {
        driveBase: driveBaseFromId(library.id),
        itemPath: `${rest}/${filename}`,
      }
    }
  }

  const library = drives.find((drive) => drive.name === folder)
  if (library?.id) {
    return { driveBase: driveBaseFromId(library.id), itemPath: filename }
  }

  const located = await findDriveFolderPath(drives, folder, accessToken)
  if (located) {
    return {
      driveBase: driveBaseFromId(located.driveId),
      itemPath: `${folder}/${filename}`,
    }
  }

  return { driveBase: defaultDrive, itemPath: `${folder}/${filename}` }
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

export async function acquireSiteGrantToken(
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
    const { driveBase, itemPath } = await resolveUploadLocation(
      "gma-write-probe.tmp"
    )
    const encodedPath = encodeDrivePath(itemPath)
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