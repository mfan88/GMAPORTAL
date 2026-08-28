import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sendUploadNotificationEmail } from "@/lib/email";
import {
  canAccessUploadPortal,
  clearUploadAccessCookieHeader,
  consumeUploadLink,
  createFileRedirectUrl,
  fillUploadReceived,
  getAppConfig,
  getPortalAccessTokenFromRequest,
  getUploadLink,
  moveEditedRowToDoneSheet,
  toRequestShape,
} from "@/lib/server/index";

export const dynamic = "force-dynamic";

type CompleteBody = {
  webUrl?: string;
  name?: string;
  id?: string;
  parentReference?: { driveId?: string };
};

/**
 * Called by the client after an upload completes successfully. Stamps the
 * received date, moves that row onto the done sheet, emails the clinic, then
 * consumes the single-use link.
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

  let body: CompleteBody = {};
  try {
    body = (await request.json()) as CompleteBody;
  } catch {
    // Older clients may POST with an empty body.
  }

  const token = getPortalAccessTokenFromRequest(shaped);
  const itemId = typeof body.id === "string" ? body.id.trim() : "";
  const driveId =
    typeof body.parentReference?.driveId === "string"
      ? body.parentReference.driveId.trim()
      : "";
  let childName = "";
  let edited: { sheetName?: string; row?: number } = {};

  if (token) {
    try {
      const [link, config] = await Promise.all([
        getUploadLink(token),
        getAppConfig(),
      ]);

      childName = link?.childName?.trim() ?? "";
      const recipients = config.uploadNotificationEmails;

      if (childName) {
        try {
          edited = await fillUploadReceived(childName);
          try {
            await moveEditedRowToDoneSheet(childName, {
              sheetName: edited.sheetName ?? "",
              row: edited.row ?? 0,
            });
          } catch (error) {
            console.error("Failed to move workbook row to done sheet:", error);
          }
        } catch (error) {
          console.error("Failed to update reference workbook:", error);
        }
      }

      if (!childName) {
        console.warn(
          "Upload notification email skipped: portal link has no child name"
        );
      } else if (!itemId) {
        console.warn(
          "Upload notification email skipped: missing Graph item id for redirect link"
        );
      } else {
        const fileUrl = await createFileRedirectUrl(request, {
          itemId,
          driveId: driveId || undefined,
        });
        const result = await sendUploadNotificationEmail({
          childName,
          fileUrl,
          to: recipients,
        });
        if (!result.sent) {
          console.warn(
            "Upload notification email skipped:",
            result.skippedReason
          );
        }
      }
    } catch (error) {
      // Upload already succeeded — never fail completion because mail failed.
      // Do not fall back to the SharePoint webUrl in the email.
      console.error("Failed to send upload notification email:", error);
    }
  }

  if (!token) {
    return NextResponse.json({ ok: true, childName, ...edited });
  }

  try {
    await consumeUploadLink(token);
  } catch (error) {
    console.error("Failed to consume upload link:", error);
  }

  const response = NextResponse.json({ ok: true, childName, ...edited });
  response.headers.append("Set-Cookie", clearUploadAccessCookieHeader());
  return response;
}
