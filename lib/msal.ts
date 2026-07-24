import type { Configuration } from "@azure/msal-browser"
import { PublicClientApplication } from "@azure/msal-browser"

// ---------------------------------------------------------------------------
// Redirect helpers
// ---------------------------------------------------------------------------

const REDIRECT_PATH = "/redirect"

export function getRedirectUri() {
  if (typeof window === "undefined") {
    return "http://localhost:3000/redirect"
  }
  return `${window.location.origin}${REDIRECT_PATH}`
}

export function clearStaleMsalUrlParams() {
  if (typeof window === "undefined") return
  if (window.location.pathname === REDIRECT_PATH) return

  const url = window.location.href
  const hasAuthParams =
    url.includes("state=") &&
    (url.includes("code=") || url.includes("error="))

  if (!hasAuthParams) return

  window.history.replaceState(
    null,
    "",
    `${window.location.origin}${window.location.pathname}`
  )
}

// ---------------------------------------------------------------------------
// Browser MSAL config
// ---------------------------------------------------------------------------

export const msalClientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ?? ""

// /common requires Azure app SignInAudience = AzureADandPersonalMicrosoftAccount
// ("Accounts in any org directory and personal Microsoft accounts").
export const msalAuthority =
  process.env.NEXT_PUBLIC_AZURE_AUTHORITY ??
  "https://login.microsoftonline.com/common"

export const graphScopes = ["User.Read", "Files.ReadWrite"] as const

export const loginRequest = {
  scopes: [...graphScopes],
  authority: msalAuthority,
  prompt: "login" as const,
}

export const tokenRequest = {
  scopes: ["Files.ReadWrite"],
  authority: msalAuthority,
}

export function createMsalConfig(): Configuration {
  if (!msalClientId) {
    throw new Error(
      "Missing NEXT_PUBLIC_AZURE_CLIENT_ID. Set it in .env.local or your host environment."
    )
  }

  return {
    auth: {
      clientId: msalClientId,
      authority: msalAuthority,
      redirectUri: getRedirectUri(),
      postLogoutRedirectUri:
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3000",
    },
    cache: {
      cacheLocation: "sessionStorage",
    },
  }
}

// ---------------------------------------------------------------------------
// Browser MSAL instance
// ---------------------------------------------------------------------------

let msalInstance: PublicClientApplication | null = null

export function getMsalInstance(): PublicClientApplication {
  if (typeof window === "undefined") {
    throw new Error("MSAL can only be used in the browser")
  }

  if (!msalInstance) {
    msalInstance = new PublicClientApplication(createMsalConfig())
  }

  return msalInstance
}
