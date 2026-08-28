import type { NextRequest } from "next/server";
import { activateParentUploadLink } from "@/lib/server/index";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  return activateParentUploadLink(request, token);
}
