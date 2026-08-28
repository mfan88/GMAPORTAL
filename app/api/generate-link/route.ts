import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createAdminAccessCookieHeader,
  getAdminAccessUsername,
  getAppConfig,
  linkExpirySeconds,
  getPublicSiteOrigin,
  createUploadLink,
  toRequestShape,
  hasValidAdminAccess,
} from "@/lib/server/index";
import { parentLinkPath } from "@/lib/parentLink";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  if (!(await hasValidAdminAccess(cookieHeader))) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as {
      childName?: string;
      edc?: string;
      scheduledDate?: string | null;
    };

    const childName =
      typeof body.childName === "string" ? body.childName.trim() : "";
    const edc = typeof body.edc === "string" ? body.edc.trim() : "";
    const scheduledDate =
      typeof body.scheduledDate === "string" ? body.scheduledDate.trim() : null;

    if (!childName) {
      return NextResponse.json(
        { error: "Select a child before generating a link." },
        { status: 400 }
      );
    }
    if (!edc) {
      return NextResponse.json(
        {
          error:
            "This child needs a valid EDC date before a link can be generated.",
        },
        { status: 400 }
      );
    }

    const [
      {
        token,
        createdAt,
        childName: storedName,
        edc: storedEdc,
        scheduledDate: storedScheduledDate,
        state,
      },
      config,
    ] = await Promise.all([
      createUploadLink({
        childName,
        edc,
        scheduledDate,
      }),
      getAppConfig(),
    ]);
    const origin = getPublicSiteOrigin(toRequestShape(request));
    const url = `${origin}${parentLinkPath(token)}`;
    const response = NextResponse.json({
      token,
      url,
      createdAt,
      childName: storedName,
      edc: storedEdc,
      scheduledDate: storedScheduledDate,
      state,
      expiresInSeconds: linkExpirySeconds(config),
    });
    const username = getAdminAccessUsername(cookieHeader);
    if (username) {
      response.headers.append(
        "Set-Cookie",
        createAdminAccessCookieHeader(username)
      );
    }
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not generate link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
