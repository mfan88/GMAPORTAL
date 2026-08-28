import Link from "next/link";
import {
  DocArticle,
  GuideImage,
} from "@/components/docsChrome";

export default function GenerateALinkPage() {
  return (
    <DocArticle
        title="Generate a link"
        lead="Follow these steps whenever a parent needs to send a GMA video."
      >
        <p>
          If OneDrive is not connected yet, finish{" "}
          <Link href="/docs/login-and-setup">
            Login and setup
          </Link>{" "}
          first. The admin console is at{" "}
          <a href="https://upload.develop.bc.ca/console">
            upload.develop.bc.ca/console
          </a>
          .
        </p>

        <h2>Step 1 — Open the admin console</h2>
        <p>
          Go to{" "}
          <a href="https://upload.develop.bc.ca">upload.develop.bc.ca</a> and
          sign in to <code>/console</code> with an allowlisted Microsoft account.
        </p>
        <GuideImage
          src="/docs/guide/generate-1.png"
          alt="Step 1: Go to upload.develop.bc.ca to access the admin console"
        />

        <h2>Step 2 — Open the child list</h2>
        <p>
          Under <strong>Create New Link</strong>, click the{" "}
          <strong>Select a Child</strong> dropdown.
        </p>
        <GuideImage
          src="/docs/guide/generate-2.png"
          alt="Step 2: Click on the Select a Child dropdown"
        />

        <h2>Step 3 — Choose the child</h2>
        <p>
          Click the child’s name that you wish to generate a link for. Names
          come from the reference Excel workbook configured in Settings.
        </p>
        <GuideImage
          src="/docs/guide/generate-3.png"
          alt="Step 3: Click on the child’s name that you wish to generate a link for"
        />

        <h2>Step 4 — Generate the link</h2>
        <p>
          Click <strong>Generate new link</strong> to create the link for that
          child.
        </p>
        <GuideImage
          src="/docs/guide/generate-4.png"
          alt="Step 4: Click Generate new link to create the link for the child"
        />

        <h2>Step 5 — Copy the link</h2>
        <p>
          Under <strong>Active Links (Click to Copy to Clipboard)</strong>,
          click the new URL to copy it. The row shows the child name, EDC,
          timestamp, and status (often <strong>Provisioning</strong> for a short
          buffer, then ready for upload).
        </p>
        <p>
          The URL looks like{" "}
          <code>https://upload.develop.bc.ca/link/…</code>
        </p>
        <p>
          Send that full URL to the parent through your usual clinic channel
          (secure messaging, email, SMS — whatever your clinic already uses).
        </p>
        <GuideImage
          src="/docs/guide/generate-5.png"
          alt="Step 5: Click the link under Active Links to copy it to your clipboard"
        />

        <h2>What the parent experiences</h2>
        <ul>
          <li>
            If they open the link too early (during the short buffer), they see
            a countdown.
          </li>
          <li>When the link is active, they land on the upload page.</li>
          <li>
            After a successful upload, that same link will no longer accept
            another video.
          </li>
        </ul>

        <h2>Tips</h2>
        <ul>
          <li>
            Tell parents they only need <strong>one video</strong> and the{" "}
            <strong>date it was recorded</strong>.
          </li>
          <li>
            Remind them the page works best on a phone where the video already
            lives.
          </li>
          <li>
            If a link expires unused, generate a new one — don’t ask the parent
            to refresh an old link.
          </li>
          <li>
            If they say “it says used,” create a fresh link. The previous upload
            may have already completed.
          </li>
          <li>
            Use the <strong>X</strong> on a link row in Active Links when you no
            longer need that entry listed.
          </li>
        </ul>
      </DocArticle>
  );
}
