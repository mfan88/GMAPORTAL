import { NextResponse } from "next/server"
import {
  getOneDriveAccessToken,
  hasValidAdminAccess,
  listReferenceWorkbookColumns,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await hasValidAdminAccess(request.headers.get("cookie") ?? undefined))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 })
  }

  const workbookName =
    new URL(request.url).searchParams.get("name")?.trim() ?? ""
  if (!workbookName) {
    return NextResponse.json(
      { error: "Workbook name is required", columns: [] },
      { status: 400 }
    )
  }

  try {
    const accessToken = await getOneDriveAccessToken()
    const result = await listReferenceWorkbookColumns(accessToken, workbookName)
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load columns from the reference workbook"
    return NextResponse.json({ error: message, columns: [] }, { status: 500 })
  }
}
