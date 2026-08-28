import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PARENT_UPLOAD_PATH } from "../parentLink";
import { createPortalAccessCookieHeader } from "./cookies";
import { checkUploadLink } from "./redis";
import { publicUrl } from "./shape";

export async function activateParentUploadLink(
  request: NextRequest,
  token: string
): Promise<NextResponse> {
  const redirectToExpired = (reason?: string, availableAt?: number) => {
    const url = publicUrl("/link-expired", request);
    if (reason) url.searchParams.set("reason", reason);
    if (typeof availableAt === "number") {
      url.searchParams.set("availableAt", String(availableAt));
    }
    if (token) url.searchParams.set("token", token);
    return NextResponse.redirect(url, { status: 307 });
  };

  if (!token) return redirectToExpired();

  try {
    const result = await checkUploadLink(token);

    if (result.status === "pending") {
      return redirectToExpired("pending", result.availableAt);
    }
    if (result.status !== "active") {
      return redirectToExpired();
    }

    const response = NextResponse.redirect(
      publicUrl(PARENT_UPLOAD_PATH, request),
      { status: 307 }
    );
    response.headers.append(
      "Set-Cookie",
      createPortalAccessCookieHeader(token)
    );
    return response;
  } catch (error) {
    console.error("Portal access token check failed:", error);
    return redirectToExpired();
  }
}
