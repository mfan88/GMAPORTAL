import Link from "next/link";
import {
  DocArticle,
  GuideImage,
} from "@/components/docsChrome";

export default function ChangeSettingsPage() {
  return (
    <DocArticle
        title="Change settings"
        lead="Use this when you need to change the upload folder, child list workbook, link timing, or who can administer the portal."
      >
        <h2>Step 1 — Open the admin console</h2>
        <p>
          Go to{" "}
          <a href="https://upload.develop.bc.ca/console">
            upload.develop.bc.ca/console
          </a>{" "}
          and sign in if needed.
        </p>
        <GuideImage
          src="/docs/guide/settings-1.png"
          alt="Step 1: Go to upload.develop.bc.ca to access the admin console"
        />

        <h2>Step 2 — Unlock Settings</h2>
        <p>
          In the <strong>Settings</strong> card, click <strong>Change</strong>{" "}
          to unlock the fields.
        </p>
        <GuideImage
          src="/docs/guide/settings-2.png"
          alt="Step 2: Click Change to unlock the settings"
        />

        <h2>Step 3 — Choose the upload folder</h2>
        <p>
          Open the <strong>Upload folder</strong> dropdown and pick the OneDrive
          root folder where videos should land (for example{" "}
          <strong>GMA Uploads</strong>). The list shows root folders in the
          connected OneDrive.
        </p>
        <GuideImage
          src="/docs/guide/settings-3.png"
          alt="Step 3: Click the Upload folder dropdown to change the destination folder"
        />

        <h2>Step 4 — Choose the reference workbook</h2>
        <p>
          Open the <strong>Reference workbook</strong> dropdown and select the
          Excel (<code>.xlsx</code>) file that holds the child list. Set{" "}
          <strong>Child name column</strong> and <strong>EDC column</strong> to
          the header text (or letter) used in that workbook.
        </p>
        <GuideImage
          src="/docs/guide/settings-4.png"
          alt="Step 4: Click the Reference workbook dropdown to change the Excel file for data"
        />

        <h2>Step 5 — Adjust link timing and admin access</h2>
        <p>
          Use the arrows to set <strong>Link buffer</strong> and{" "}
          <strong>Link expiry</strong> (how long a new link waits before parents
          can upload, and how long it stays usable).
        </p>
        <p>
          Under <strong>Allowed admin emails</strong>, add one Microsoft account
          email per line, or remove a line to revoke console access. The
          receiving OneDrive account must stay on this list.
        </p>
        <GuideImage
          src="/docs/guide/settings-5.png"
          alt="Step 5: Set link buffer and expiry, and edit Allowed admin emails"
        />

        <h2>Step 6 — Save</h2>
        <p>
          Click <strong>Save</strong> to apply the changes and lock the settings
          fields again. Use <strong>Cancel</strong> if you want to discard
          edits.
        </p>
        <GuideImage
          src="/docs/guide/settings-6.png"
          alt="Step 6: Click Save to lock the changes"
        />

        <p>
          Back to{" "}
          <Link href="/docs/generate-a-link">
            Generate a link
          </Link>{" "}
          when you are ready to send a parent upload URL.
        </p>
      </DocArticle>
  );
}
