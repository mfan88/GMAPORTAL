import { randomBytes, createHash } from "node:crypto";

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  return { verifier, challenge };
}

export const PKCE_COOKIE_NAME = "onedrive_pkce";
export const AUTH_FLOW_COOKIE_NAME = "onedrive_auth_flow";

export type OneDriveAuthFlow =
  "setup" | "upload-access" | "admin" | "site-grant";

function buildCookie(name: string, value: string, maxAgeSeconds: number) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function clearCookie(name: string) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export function pkceCookieHeader(verifier: string) {
  return buildCookie(PKCE_COOKIE_NAME, encodeURIComponent(verifier), 600);
}

export function clearPkceCookieHeader() {
  return clearCookie(PKCE_COOKIE_NAME);
}

export function authFlowCookieHeader(flow: OneDriveAuthFlow) {
  return buildCookie(AUTH_FLOW_COOKIE_NAME, flow, 600);
}

export function clearAuthFlowCookieHeader() {
  return clearCookie(AUTH_FLOW_COOKIE_NAME);
}

export function setPkceCookie(
  res: { setHeader: (name: string, value: string) => void },
  verifier: string
) {
  res.setHeader("Set-Cookie", pkceCookieHeader(verifier));
}

export function setAuthFlowCookie(
  res: { setHeader: (name: string, value: string | string[]) => void },
  flow: OneDriveAuthFlow
) {
  res.setHeader("Set-Cookie", authFlowCookieHeader(flow));
}

export function clearPkceCookie(res: {
  setHeader: (name: string, value: string) => void;
}) {
  res.setHeader("Set-Cookie", clearPkceCookieHeader());
}

export function getPkceCookie(req: { headers: { cookie?: string } }) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === PKCE_COOKIE_NAME) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

export function getAuthFlowCookie(req: {
  headers: { cookie?: string };
}): OneDriveAuthFlow | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === AUTH_FLOW_COOKIE_NAME) {
      const value = rest.join("=");
      if (
        value === "setup" ||
        value === "upload-access" ||
        value === "admin" ||
        value === "site-grant"
      ) {
        return value;
      }
    }
  }

  return null;
}
