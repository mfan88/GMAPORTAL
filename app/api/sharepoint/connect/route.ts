import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
  connectSharePointSite,
  hasValidAdminAccess,
} from "@/lib/server/index"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!(await hasValidAdminAccess(request.headers.get("cookie") ?? undefined))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 })
  }

  let body: { siteUrl?: string } = {}
  try {
    body = (await request.json()) as { siteUrl?: string }
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with siteUrl." },
      { status: 400 }
    )
  }

  const siteUrl = typeof body.siteUrl === "string" ? body.siteUrl.trim() : ""
  if (!siteUrl) {
    return NextResponse.json(
      { error: "Provide a SharePoint site URL or site id." },
      { status: 400 }
    )
  }

  try {
    const site = await connectSharePointSite(siteUrl)
    return NextResponse.json({
      connected: true,
      ...site,
      username: site.siteName,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not connect SharePoint site"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
