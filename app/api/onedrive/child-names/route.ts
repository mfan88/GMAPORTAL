import { NextResponse } from "next/server"
import {
  getOneDriveAccessToken,
  hasValidAdminAccess,
  listChildNamesFromReferenceWorkbook,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await hasValidAdminAccess(request.headers.get("cookie") ?? undefined))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 })
  }

  try {
    const accessToken = await getOneDriveAccessToken()
    const result = await listChildNamesFromReferenceWorkbook(accessToken)
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load child names from the reference workbook"
    return NextResponse.json({ error: message, children: [], names: [] }, { status: 500 })
  }
}
