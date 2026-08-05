import "server-only"

import { EmailClient, type EmailMessage } from "@azure/communication-email"

export type UploadNotificationInput = {
  childName: string
  fileUrl: string
  fileName?: string
  /** Microsoft account(s) that should receive the notice (drive owner / admins). */
  to: string[]
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function getEmailClient(): EmailClient | null {
  const connectionString =
    process.env.AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING?.trim()
  if (!connectionString) return null
  return new EmailClient(connectionString)
}

function getSenderAddress(): string | null {
  return process.env.AZURE_EMAIL_SENDER_ADDRESS?.trim() || null
}

/**
 * Notify clinic staff that a parent uploaded a GMA video.
 * Subject includes the child name from the temp portal link; body links to the
 * file in the connected OneDrive.
 */
export async function sendUploadNotificationEmail(
  input: UploadNotificationInput
): Promise<{ sent: boolean; skippedReason?: string }> {
  const childName = input.childName.trim()
  const fileUrl = input.fileUrl.trim()
  const recipients = [
    ...new Set(
      input.to
        .map((address) => address.trim().toLowerCase())
        .filter(Boolean)
    ),
  ]

  if (!childName) {
    return { sent: false, skippedReason: "Missing child name" }
  }
  if (!fileUrl) {
    return { sent: false, skippedReason: "Missing file URL" }
  }
  if (recipients.length === 0) {
    return { sent: false, skippedReason: "No notification recipients" }
  }

  const client = getEmailClient()
  if (!client) {
    return {
      sent: false,
      skippedReason: "AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING is not set",
    }
  }

  const senderAddress = getSenderAddress()
  if (!senderAddress) {
    return {
      sent: false,
      skippedReason: "AZURE_EMAIL_SENDER_ADDRESS is not set",
    }
  }

  const safeName = escapeHtml(childName)
  const safeUrl = escapeHtml(fileUrl)
  const safeFileName = input.fileName?.trim()
    ? escapeHtml(input.fileName.trim())
    : null

  const subject = `${childName}'s parent has uploaded a new video to your OneDrive`
  const plainText = [
    `Hello,`,
    ``,
    `${childName}'s parent has uploaded a new video to your OneDrive.`,
    safeFileName ? `File: ${input.fileName!.trim()}` : null,
    ``,
    `Open the video here:`,
    fileUrl,
  ]
    .filter((line): line is string => line !== null)
    .join("\n")

  const html = `
    <p>Hello,</p>
    <p><strong>${safeName}</strong>'s parent has uploaded a new video to your OneDrive.</p>
    ${safeFileName ? `<p>File: ${safeFileName}</p>` : ""}
    <p><a href="${safeUrl}">Open the video in OneDrive</a></p>
    <p style="word-break:break-all;color:#555;font-size:12px;">${safeUrl}</p>
  `.trim()

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
  }

  const poller = await client.beginSend(message)
  await poller.pollUntilDone()
  return { sent: true }
}
