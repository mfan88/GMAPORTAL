import type { Configuration } from "@azure/msal-browser";
import { PublicClientApplication } from "@azure/msal-browser";

// ---------------------------------------------------------------------------
// Redirect helpers
// ---------------------------------------------------------------------------

const REDIRECT_PATH = "/redirect";

function configuredBrowserOrigin(): string | null {
  const raw = process.env["NEXT_PUBLIC_APP_URL"]
    ?.trim()
    .replace(/^["']|["']$/g, "");
  if (!raw) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

export function getRedirectUri() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${REDIRECT_PATH}`;
  }

  const configured = configuredBrowserOrigin();
  if (configured) return `${configured}${REDIRECT_PATH}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing NEXT_PUBLIC_APP_URL. Set it to your public origin, e.g. https://upload.fenna.tech."
    );
  }

  return `http://localhost:3000${REDIRECT_PATH}`;
}

export function clearStaleMsalUrlParams() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === REDIRECT_PATH) return;

  const url = window.location.href;
  const hasAuthParams =
    url.includes("state=") && (url.includes("code=") || url.includes("error="));

  if (!hasAuthParams) return;

  window.history.replaceState(
    null,
    "",
    `${window.location.origin}${window.location.pathname}`
  );
}

// ---------------------------------------------------------------------------
// Browser MSAL config
// ---------------------------------------------------------------------------

export const msalClientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ?? "";

export const msalAuthority =
  process.env.NEXT_PUBLIC_AZURE_AUTHORITY ??
  (process.env.NEXT_PUBLIC_AZURE_TENANT_ID
    ? `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`
    : "https://login.microsoftonline.com/organizations");

export const graphScopes = ["User.Read"] as const;

export const loginRequest = {
  scopes: [...graphScopes],
  authority: msalAuthority,
  prompt: "login" as const,
};

export const tokenRequest = {
  scopes: ["User.Read"],
  authority: msalAuthority,
};

function resolvePostLogoutRedirectUri() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const configured = configuredBrowserOrigin();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing NEXT_PUBLIC_APP_URL. Set it to your public origin, e.g. https://upload.fenna.tech."
    );
  }

  return "http://localhost:3000";
}

export function createMsalConfig(): Configuration {
  if (!msalClientId) {
    throw new Error(
      "Missing NEXT_PUBLIC_AZURE_CLIENT_ID. Set it in .env.local or your host environment."
    );
  }

  return {
    auth: {
      clientId: msalClientId,
      authority: msalAuthority,
      redirectUri: getRedirectUri(),
      postLogoutRedirectUri: resolvePostLogoutRedirectUri(),
    },
    cache: {
      cacheLocation: "sessionStorage",
    },
  };
}

// ---------------------------------------------------------------------------
// Browser MSAL instance
// ---------------------------------------------------------------------------

let msalInstance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication {
  if (typeof window === "undefined") {
    throw new Error("MSAL can only be used in the browser");
  }

  if (!msalInstance) {
    msalInstance = new PublicClientApplication(createMsalConfig());
  }

  return msalInstance;
}
