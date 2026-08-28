import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getOneDriveRedirectUri,
  getRegisteredRedirectUris,
  getUploadAccessRedirectUri,
  clearOneDriveConnection,
  getOneDriveConnectionStatus,
  getBlobAuthMode,
  getTokenStorageDescription,
  hasValidAdminAccess,
  usesBlobTokenStore,
  toRequestShape,
} from "@/lib/server/index";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const shaped = toRequestShape(request);

  try {
    const status = await getOneDriveConnectionStatus();

    return NextResponse.json({
      ...status,
      redirectUri: getOneDriveRedirectUri(shaped),
      uploadAccessRedirectUri: getUploadAccessRedirectUri(shaped),
      redirectUris: getRegisteredRedirectUris(shaped),
      originDebug: {
        appUrl: process.env.APP_URL ?? null,
        nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
        host: shaped.headers.host ?? null,
        forwardedHost: shaped.headers["x-forwarded-host"] ?? null,
        forwardedProto: shaped.headers["x-forwarded-proto"] ?? null,
      },
      tokenStorage: getTokenStorageDescription(),
      blobConfigured: usesBlobTokenStore(),
      blobAuth: getBlobAuthMode(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read OneDrive status";
    return NextResponse.json(
      { connected: false, username: null, error: message },
      { status: 200 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (
    !(await hasValidAdminAccess(request.headers.get("cookie") ?? undefined))
  ) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 401 }
    );
  }

  // Disconnect SharePoint site config — keep the admin console session.
  await clearOneDriveConnection();
  return NextResponse.json({ connected: false });
}
