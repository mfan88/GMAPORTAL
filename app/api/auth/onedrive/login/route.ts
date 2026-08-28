import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasValidAdminAccess, publicUrl } from "@/lib/server/index";

export const dynamic = "force-dynamic";

/**
 * Legacy "connect OneDrive user" route. Destination is now a SharePoint site
 * configured at /setup via Sites.Selected app-only access.
 */
export async function GET(request: NextRequest) {
  if (
    !(await hasValidAdminAccess(request.headers.get("cookie") ?? undefined))
  ) {
    return NextResponse.redirect(publicUrl("/api/auth/admin/login", request), {
      status: 307,
    });
  }

  return NextResponse.redirect(
    publicUrl("/setup?error=use_sharepoint_connect", request),
    { status: 307 }
  );
}
