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

  const searchParams = new URL(request.url).searchParams
  const workbookName = searchParams.get("name")?.trim() ?? ""
  const worksheetName = searchParams.get("sheet")?.trim() ?? ""
  if (!workbookName) {
    return NextResponse.json(
      { error: "Workbook name is required", columns: [], sheets: [] },
      { status: 400 }
    )
  }

  try {
    const accessToken = await getOneDriveAccessToken()
    const result = await listReferenceWorkbookColumns(
      accessToken,
      workbookName,
      worksheetName || undefined
    )
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load columns from the reference workbook"
    return NextResponse.json(
      { error: message, columns: [], sheets: [] },
      { status: 500 }
    )
  }
}
