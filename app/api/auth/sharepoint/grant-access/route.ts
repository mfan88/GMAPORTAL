import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
  authFlowCookieHeader,
  createPkcePair,
  getConfiguredSharePointSiteId,
  getSiteGrantLoginUrl,
  hasValidAdminAccess,
  pkceCookieHeader,
  publicUrl,
  toRequestShape,
} from "@/lib/server"

export const dynamic = "force-dynamic"

/**
 * Starts a one-time Microsoft sign-in (Sites.FullControl.All) so an allowlisted
 * admin can grant this app write on the connected SharePoint site.
 */
export async function GET(request: NextRequest) {
  if (!(await hasValidAdminAccess(request.headers.get("cookie") ?? undefined))) {
    return NextResponse.redirect(publicUrl("/api/auth/admin/login", request), {
      status: 307,
    })
  }

  const siteId = await getConfiguredSharePointSiteId()
  if (!siteId) {
    return NextResponse.redirect(
      publicUrl("/setup?error=site_not_connected", request),
      { status: 307 }
    )
  }

  try {
    const { verifier, challenge } = createPkcePair()
    const loginUrl = await getSiteGrantLoginUrl(
      challenge,
      toRequestShape(request)
    )
    const response = NextResponse.redirect(loginUrl, { status: 307 })
    response.headers.append("Set-Cookie", pkceCookieHeader(verifier))
    response.headers.append("Set-Cookie", authFlowCookieHeader("site-grant"))
    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start site grant"
    return NextResponse.redirect(
      publicUrl(`/setup?error=${encodeURIComponent(message)}`, request),
      { status: 307 }
    )
  }
}
