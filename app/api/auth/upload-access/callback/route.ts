import type { NextRequest } from "next/server";
import { handleOneDriveOAuthCallback } from "@/lib/server/index";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleOneDriveOAuthCallback(request);
}
