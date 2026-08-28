import { NextResponse } from "next/server";
import {
  getOneDriveAccessToken,
  hasValidAdminAccess,
  listOneDriveRootFolders,
  listOneDriveWorkbooks,
} from "@/lib/server/index";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (
    !(await hasValidAdminAccess(request.headers.get("cookie") ?? undefined))
  ) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 401 }
    );
  }

  try {
    const accessToken = await getOneDriveAccessToken();
    const [folders, workbooks] = await Promise.all([
      listOneDriveRootFolders(accessToken),
      listOneDriveWorkbooks(accessToken),
    ]);

    return NextResponse.json({ folders, workbooks });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load OneDrive folders and workbooks";
    return NextResponse.json(
      { error: message, folders: [], workbooks: [] },
      { status: 500 }
    );
  }
}
