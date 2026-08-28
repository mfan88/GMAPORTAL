import { NextResponse } from "next/server";
import { resolveFileRedirectWebUrl } from "@/lib/server/index";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

  try {
    const webUrl = await resolveFileRedirectWebUrl(slug);
    if (!webUrl) {
      return new NextResponse("File not found.", { status: 404 });
    }
    return NextResponse.redirect(webUrl, { status: 307 });
  } catch (error) {
    console.error("File redirect failed:", error);
    return new NextResponse("Could not open file.", { status: 502 });
  }
}
