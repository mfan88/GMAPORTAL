import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  canAccessUploadPortal,
  getPortalAccessTokenFromRequest,
  getUploadLink,
  moveEditedRowToDoneSheet,
  toRequestShape,
} from "@/lib/server/index";

export const dynamic = "force-dynamic";

type MoveBody = {
  childName?: string;
  sheetName?: string;
  row?: number;
};

/**
 * Moves the child's tracking row onto "GMA done or not received" at the next
 * empty data row. Intended to run after the received-date stamp.
 */
export async function POST(request: NextRequest) {
  const shaped = toRequestShape(request);
  const access = await canAccessUploadPortal(shaped);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "Upload access required." },
      { status: 401 }
    );
  }

  let body: MoveBody = {};
  try {
    body = (await request.json()) as MoveBody;
  } catch {
    body = {};
  }

  let childName =
    typeof body.childName === "string" ? body.childName.trim() : "";

  if (!childName) {
    const token = getPortalAccessTokenFromRequest(shaped);
    if (token) {
      const link = await getUploadLink(token);
      childName = link?.childName?.trim() ?? "";
    }
  }

  if (!childName) {
    return NextResponse.json(
      { error: "A child name is required to move the workbook row." },
      { status: 400 }
    );
  }

  try {
    const sheetName =
      typeof body.sheetName === "string" ? body.sheetName.trim() : "";
    const row = typeof body.row === "number" ? body.row : Number(body.row);
    const edited =
      sheetName && Number.isInteger(row) && row >= 2
        ? { sheetName, row }
        : undefined;
    const result = await moveEditedRowToDoneSheet(childName, edited);
    return NextResponse.json({ ok: true, destRow: result.destRow });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not move workbook row";
    console.error("Failed to move workbook row to done sheet:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
