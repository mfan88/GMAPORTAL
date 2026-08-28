import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { sendUploadNotificationEmail } from "@/lib/email"
import {
  canAccessUploadPortal,
  clearUploadAccessCookieHeader,
  consumeUploadLink,
  createFileRedirectUrl,
  getAppConfig,
  getPortalAccessTokenFromRequest,
  getUploadLink,
  toRequestShape,
} from "@/lib/server/index"

export const dynamic = "force-dynamic"

type CompleteBody = {
  webUrl?: string
  name?: string
  id?: string
  parentReference?: { driveId?: string }
}

/**
 * Called by the client after an upload completes successfully. This consumes the
 * parent's single-use link and revokes their session cookie, so each link is
 * good for exactly one successful upload. Also emails the configured
 * allowlisted admin with the child name + file link.
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
  const itemId = typeof body.id === "string" ? body.id.trim() : ""
  const driveId =
    typeof body.parentReference?.driveId === "string"
      ? body.parentReference.driveId.trim()
      : ""

  if (token) {
    try {
      const [link, config] = await Promise.all([
        getUploadLink(token),
        getAppConfig(),
      ])

      const childName = link?.childName?.trim() ?? ""
      const recipients = config.uploadNotificationEmails

      if (!childName) {
        console.warn(
          "Upload notification email skipped: portal link has no child name"
        )
      } else if (!itemId) {
        console.warn(
          "Upload notification email skipped: missing Graph item id for redirect link"
        )
      } else {
        const fileUrl = await createFileRedirectUrl(request, {
          itemId,
          driveId: driveId || undefined,
        })
        const result = await sendUploadNotificationEmail({
          childName,
          fileUrl,
          to: recipients,
        })
        if (!result.sent) {
          console.warn(
            "Upload notification email skipped:",
            result.skippedReason
          )
        }
      }
    } catch (error) {
      // Upload already succeeded — never fail completion because mail failed.
      // Do not fall back to the SharePoint webUrl in the email.
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
