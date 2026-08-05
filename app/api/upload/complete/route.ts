import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { sendUploadNotificationEmail } from "@/lib/email"
import {
  canAccessUploadPortal,
  clearUploadAccessCookieHeader,
  consumeUploadLink,
  getAppConfig,
  getConnectedOneDriveAccount,
  getPortalAccessTokenFromRequest,
  getUploadLink,
  toRequestShape,
} from "@/lib/server"

export const dynamic = "force-dynamic"

type CompleteBody = {
  webUrl?: string
  name?: string
}

/**
 * Called by the client after an upload completes successfully. This consumes the
 * parent's single-use link and revokes their session cookie, so each link is
 * good for exactly one successful upload. Also emails the connected OneDrive
 * owner (and allowlisted admins) with the child name + file link.
 */
export async function POST(request: NextRequest) {
  const shaped = toRequestShape(request)

  const access = await canAccessUploadPortal(shaped)
  if (!access.allowed) {
    return NextResponse.json(
      { error: "Upload access required." },
      { status: 401 }
    )
  }

  let body: CompleteBody = {}
  try {
    body = (await request.json()) as CompleteBody
  } catch {
    // Older clients may POST with an empty body.
  }

  const token = getPortalAccessTokenFromRequest(shaped)
  const webUrl = typeof body.webUrl === "string" ? body.webUrl.trim() : ""
  const fileName = typeof body.name === "string" ? body.name.trim() : ""

  if (token && webUrl) {
    try {
      const [link, account, config] = await Promise.all([
        getUploadLink(token),
        getConnectedOneDriveAccount(),
        getAppConfig(),
      ])

      const childName = link?.childName?.trim() ?? ""
      const recipients = [
        account?.username,
        ...config.allowedAdminEmails,
      ].filter((address): address is string => Boolean(address?.trim()))

      if (childName) {
        const result = await sendUploadNotificationEmail({
          childName,
          fileUrl: webUrl,
          fileName: fileName || undefined,
          to: recipients,
        })
        if (!result.sent) {
          console.warn(
            "Upload notification email skipped:",
            result.skippedReason
          )
        }
      } else {
        console.warn(
          "Upload notification email skipped: portal link has no child name"
        )
      }
    } catch (error) {
      // Upload already succeeded — never fail completion because mail failed.
      console.error("Failed to send upload notification email:", error)
    }
  }

  // Admins (no bound link) keep their access; nothing to consume.
  if (!token) {
    return NextResponse.json({ ok: true })
  }

  try {
    await consumeUploadLink(token)
  } catch (error) {
    console.error("Failed to consume upload link:", error)
  }

  const response = NextResponse.json({ ok: true })
  response.headers.append("Set-Cookie", clearUploadAccessCookieHeader())
  return response
}
