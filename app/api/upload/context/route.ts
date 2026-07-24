import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
  canAccessUploadPortal,
  getPortalAccessTokenFromRequest,
  getUploadLink,
  toRequestShape,
} from "@/lib/server"

export const dynamic = "force-dynamic"

/**
 * Returns the child name + age bound to the caller's portal-access cookie,
 * so the upload UI can apply the admin-assigned naming scheme.
 */
export async function GET(request: NextRequest) {
  const shaped = toRequestShape(request)
  const access = await canAccessUploadPortal(shaped)
  if (!access.allowed) {
    return NextResponse.json({ error: "Upload access required." }, { status: 401 })
  }

  const token = getPortalAccessTokenFromRequest(shaped)
  if (!token) {
    return NextResponse.json({
      childName: null,
      ageWeeks: null,
      fromLink: false,
    })
  }

  const link = await getUploadLink(token)
  if (!link || link.state === "used") {
    return NextResponse.json({
      childName: null,
      ageWeeks: null,
      fromLink: false,
    })
  }

  return NextResponse.json({
    childName: link.childName,
    ageWeeks: link.ageWeeks,
    fromLink: true,
  })
}
