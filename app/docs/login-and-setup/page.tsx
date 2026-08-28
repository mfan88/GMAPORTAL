import Link from "next/link";
import {
  DocArticle,
  GuideImage,
} from "@/components/docsChrome";

export default function LoginAndSetupPage() {
  return (
    <DocArticle
        title="Login and setup"
        lead="Do this once when the clinic first connects the portal, or whenever you need to reconnect OneDrive."
      >
        <h2>Step 1 — Open the admin console</h2>
        <p>
          Go to{" "}
          <a href="https://upload.develop.bc.ca">upload.develop.bc.ca</a> and
          open the admin console at <code>/console</code>. Bookmark{" "}
          <strong>GMA Upload Portal</strong> if you use it often.
        </p>
        <GuideImage
          src="/docs/guide/login-1.png"
          alt="Step 1: Go to upload.develop.bc.ca to access the admin console"
        />

        <h2>Step 2 — Sign in with Microsoft</h2>
        <h3>Step 2a</h3>
        <p>
          If you are not already signed in to Microsoft 365, enter your work
          email and password.
        </p>
        <GuideImage
          src="/docs/guide/login-2.png"
          alt="Step 2a: If you are not signed in to Microsoft 365, enter your email and password"
        />

        <h3>Step 2b</h3>
        <p>
          If Microsoft shows <strong>Pick an account</strong>, choose the
          allowlisted clinic account you use for this portal.
        </p>
        <GuideImage
          src="/docs/guide/login-3.png"
          alt="Step 2b: Pick the account to sign into"
        />
        <p>
          Only emails listed under <strong>Allowed admin emails</strong> can
          open the console.
        </p>

        <h2>Step 3 — Connect the receiving OneDrive</h2>
        <p>
          Videos land in a Microsoft OneDrive account you choose. That receiving
          account must already appear in <strong>Allowed admin emails</strong>{" "}
          before you connect it. Console login can still use a different
          allowlisted account.
        </p>

        <h3>Step 3a</h3>
        <p>
          Under <strong>Current Status</strong>, click{" "}
          <strong>Connect receiving OneDrive</strong> and complete the Microsoft
          sign-in for the account that should store videos.
        </p>
        <GuideImage
          src="/docs/guide/login-4.png"
          alt="Step 3a: Click Connect receiving OneDrive to set up the account that stores videos"
        />

        <h3>Step 3b</h3>
        <p>
          Confirm the receiving account is on the allowlist. In Settings you
          should see one Microsoft account email per line. Add the destination
          email on its own line if it is missing, then save — see{" "}
          <Link href="/docs/change-settings">
            Change settings
          </Link>
          .
        </p>
        <GuideImage
          src="/docs/guide/login-5.png"
          alt="Step 3b: Ensure the receiving OneDrive account is among Allowed admin emails"
        />

        <h2>Step 4 — Verify the connection is active</h2>
        <p>
          Under <strong>Current Status</strong>, you should see a green{" "}
          <strong>Active</strong> indicator and a line like{" "}
          <strong>Videos upload to:</strong> followed by the connected email.
          You can use <strong>Change receiving OneDrive</strong> or{" "}
          <strong>Disconnect</strong> later if the destination needs to change.
        </p>
        <GuideImage
          src="/docs/guide/login-6.png"
          alt="Step 4: Verify Current Status shows Active"
        />

        <p>
          After setup, confirm the child list loads from the reference Excel
          workbook in OneDrive. If something fails, see{" "}
          <Link href="/docs/technical/troubleshooting">
            Troubleshooting
          </Link>
          .
        </p>

        <p>
          Next:{" "}
          <Link href="/docs/generate-a-link">
            Generate a link
          </Link>
          .
        </p>
      </DocArticle>
  );
}
