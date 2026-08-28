import "server-only";

import { EmailClient, type EmailMessage } from "@azure/communication-email";

export type UploadNotificationInput = {
  childName: string;
  fileUrl: string;
  /** Microsoft account(s) that should receive the notice (drive owner / admins). */
  to: string[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getEmailClient(): EmailClient | null {
  const connectionString =
    process.env.AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING?.trim();
  if (!connectionString) return null;
  return new EmailClient(connectionString);
}

function getSenderAddress(): string | null {
  return process.env.AZURE_EMAIL_SENDER_ADDRESS?.trim() || null;
}

/**
 * Notify clinic staff that a parent uploaded a GMA video.
 * Body links only to the same-origin /v/{slug} redirect (never the SharePoint
 * webUrl).
 */
export async function sendUploadNotificationEmail(
  input: UploadNotificationInput
): Promise<{ sent: boolean; skippedReason?: string }> {
  const childName = input.childName.trim();
  const fileUrl = input.fileUrl.trim();
  const recipients = [
    ...new Set(
      input.to.map((address) => address.trim().toLowerCase()).filter(Boolean)
    ),
  ];

  if (!childName) {
    return { sent: false, skippedReason: "Missing child name" };
  }
  if (!fileUrl) {
    return { sent: false, skippedReason: "Missing file URL" };
  }
  if (recipients.length === 0) {
    return { sent: false, skippedReason: "No notification recipients" };
  }

  const client = getEmailClient();
  if (!client) {
    return {
      sent: false,
      skippedReason:
        "AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING is not set",
    };
  }

  const senderAddress = getSenderAddress();
  if (!senderAddress) {
    return {
      sent: false,
      skippedReason: "AZURE_EMAIL_SENDER_ADDRESS is not set",
    };
  }

  const safeUrl = escapeHtml(fileUrl);

  const subject = `A parent has uploaded a new video to your SharePoint`;
  const plainText = [
    `Hello!`,
    ``,
    `A parent has uploaded a new video to your SharePoint.`,
    ``,
    `Open the video: ${fileUrl}`,
  ].join("\n");

  const html = `
    <p>Hello!</p>
    <p>A parent has uploaded a new video to SharePoint.</p>
    <p><a href="${safeUrl}">Click here to see the video</a></p>
  `.trim();

  const message: EmailMessage = {
    senderAddress,
    content: {
      subject,
      plainText,
      html,
    },
    recipients: {
      to: recipients.map((address) => ({ address })),
    },
  };

  const poller = await client.beginSend(message);
  await poller.pollUntilDone();
  return { sent: true };
}
