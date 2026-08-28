import { NextRequest, NextResponse } from "next/server";
import {
  acquireSiteGrantToken,
  getConfiguredSharePointSiteId,
  grantSharePointAppWriteAccess,
  verifyUploadAccessIdentity,
} from "./auth";
import { adminAllowlistRejectionReason } from "./configHelper";
import { createAdminAccessCookieHeader } from "./cookies";
import { msalClientSecret } from "./msalHelpers";
import {
  clearAdminNextCookieHeader,
  clearAuthFlowCookieHeader,
  clearPkceCookieHeader,
  getAdminNextCookie,
  getAuthFlowCookie,
  getPkceCookie,
  safeAdminNextPath,
} from "./pkce";
import { publicUrl, toRequestShape } from "./shape";

function redirectWithCookies(
  request: NextRequest,
  redirectPath: string,
  cookies: string[]
) {
  const response = NextResponse.redirect(publicUrl(redirectPath, request), {
    status: 307,
  });
  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}

type RequestShape = ReturnType<typeof toRequestShape>;

const CLEAR_AUTH_COOKIES = () => [
  clearPkceCookieHeader(),
  clearAuthFlowCookieHeader(),
  clearAdminNextCookieHeader(),
];

function errorRedirect(
  request: NextRequest,
  flow: string,
  reason: string
): NextResponse {
  const destination =
    flow === "upload-access" || flow === "admin"
      ? `/upload-access-denied?error=${encodeURIComponent(reason)}`
      : `/console?error=${encodeURIComponent(reason)}`;
  return redirectWithCookies(request, destination, CLEAR_AUTH_COOKIES());
}

async function completeSiteGrantFlow(
  request: NextRequest,
  shaped: RequestShape,
  code: string,
  codeVerifier: string
): Promise<NextResponse> {
  const clearCookies = CLEAR_AUTH_COOKIES();
  const result = await acquireSiteGrantToken(code, codeVerifier, shaped);
  const username = result.account?.username;
  if (!username || !result.accessToken) {
    return redirectWithCookies(
      request,
      "/console?error=missing_account",
      clearCookies
    );
  }

  const adminRejection = await adminAllowlistRejectionReason(username);
  if (adminRejection) {
    return redirectWithCookies(
      request,
      `/console?error=${adminRejection}`,
      clearCookies
    );
  }

  const siteId = await getConfiguredSharePointSiteId();
  if (!siteId) {
    return redirectWithCookies(request, "/console?error=site_not_connected", [
      ...clearCookies,
      createAdminAccessCookieHeader(username),
    ]);
  }

  try {
    await grantSharePointAppWriteAccess(result.accessToken, siteId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "grant_failed";
    return redirectWithCookies(
      request,
      `/console?error=${encodeURIComponent(message)}`,
      [...clearCookies, createAdminAccessCookieHeader(username)]
    );
  }

  return redirectWithCookies(request, "/console?granted=1", [
    ...clearCookies,
    createAdminAccessCookieHeader(username),
  ]);
}

async function completeUploadAccessFlow(
  request: NextRequest,
  shaped: RequestShape,
  code: string,
  codeVerifier: string
): Promise<NextResponse> {
  // Same gate as admin — Sites.Selected has no receiving user mailbox to match.
  return completeAdminFlow(request, shaped, code, codeVerifier);
}

async function completeAdminFlow(
  request: NextRequest,
  shaped: RequestShape,
  code: string,
  codeVerifier: string
): Promise<NextResponse> {
  const clearCookies = CLEAR_AUTH_COOKIES();

  const signedInAccount = await verifyUploadAccessIdentity(
    code,
    codeVerifier,
    shaped
  );
  if (!signedInAccount?.username) {
    return redirectWithCookies(
      request,
      "/upload-access-denied?error=missing_account",
      clearCookies
    );
  }

  const adminRejection = await adminAllowlistRejectionReason(
    signedInAccount.username
  );
  if (adminRejection) {
    return redirectWithCookies(
      request,
      `/upload-access-denied?error=${adminRejection}`,
      clearCookies
    );
  }

  const next = safeAdminNextPath(getAdminNextCookie(shaped));

  return redirectWithCookies(request, next, [
    ...clearCookies,
    createAdminAccessCookieHeader(signedInAccount.username),
  ]);
}

async function completeSetupFlow(
  request: NextRequest,
  _shaped: RequestShape,
  _code: string,
  _codeVerifier: string
): Promise<NextResponse> {
  return redirectWithCookies(
    request,
    "/console?error=use_sharepoint_connect",
    CLEAR_AUTH_COOKIES()
  );
}

export async function handleOneDriveOAuthCallback(request: NextRequest) {
  const shaped = toRequestShape(request);
  const flow = getAuthFlowCookie(shaped) ?? "setup";
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const error = params.get("error");

  if (error) {
    return errorRedirect(
      request,
      flow,
      params.get("error_description") ?? error
    );
  }
  if (!code) {
    return errorRedirect(request, flow, "missing_code");
  }

  const codeVerifier = getPkceCookie(shaped);
  if (!codeVerifier) {
    return errorRedirect(request, flow, "missing_pkce_verifier");
  }

  try {
    if (flow === "site-grant") {
      return await completeSiteGrantFlow(request, shaped, code, codeVerifier);
    }
    if (flow === "upload-access") {
      return await completeUploadAccessFlow(
        request,
        shaped,
        code,
        codeVerifier
      );
    }
    if (flow === "admin") {
      return await completeAdminFlow(request, shaped, code, codeVerifier);
    }
    return await completeSetupFlow(request, shaped, code, codeVerifier);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "callback_failed";
    const needsSecret =
      /AADSTS70002|client_secret/i.test(raw) && !msalClientSecret;
    const message = needsSecret
      ? "Missing AZURE_CLIENT_SECRET. Create a client secret in Azure App registration → Certificates & secrets, then set AZURE_CLIENT_SECRET in Vercel / .env.local and redeploy."
      : raw;
    return errorRedirect(request, flow, message);
  }
}
