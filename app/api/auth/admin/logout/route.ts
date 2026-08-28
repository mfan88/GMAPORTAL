import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
  clearAdminAccessCookieHeader,
  clearAuthFlowCookieHeader,
  clearPkceCookieHeader,
  getMicrosoftLogoutUrl,
  publicUrl,
} from "@/lib/server/index"

export const dynamic = "force-dynamic"

/**
 * Clears the admin console session cookie and ends the Microsoft login session
 * so the next visit can choose a different allowlisted work account.
 */
export async function GET(request: NextRequest) {
  const afterLogout = publicUrl("/", request).toString()
  const response = NextResponse.redirect(getMicrosoftLogoutUrl(afterLogout), {
    status: 307,
  })
  response.headers.append("Set-Cookie", clearAdminAccessCookieHeader())
  response.headers.append("Set-Cookie", clearPkceCookieHeader())
  response.headers.append("Set-Cookie", clearAuthFlowCookieHeader())
  return response
}

export async function POST(request: NextRequest) {
  return GET(request)
}
