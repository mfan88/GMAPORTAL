import Link from "next/link";
import {
  DocArticle,
  GuideImage,
} from "@/components/docsChrome";

export default function EntraIdSetupPage() {
  return (
    <DocArticle
        title="Entra ID app registration"
        lead="Register a single-tenant Microsoft Entra ID application for this organization so staff can sign in and the portal can use Microsoft Graph / OneDrive. Do this once per tenant (or environment) before clinic login and setup."
      >
        <p>
          Screenshots use tenant <strong>fenna.tech</strong> and host{" "}
          <code>https://upload.develop.bc.ca</code>. Substitute your directory
          and <code>{"{APP_URL}"}</code> everywhere a URL appears. You need an
          Entra role that can create app registrations and grant admin consent
          (for example Application Administrator or Global Administrator).
        </p>

        <h2>Step 1 — Open Microsoft Entra ID</h2>
        <p>
          Sign in to the{" "}
          <a href="https://portal.azure.com">Azure portal</a> with an admin
          account for the target organization. Open the portal menu and select{" "}
          <strong>Microsoft Entra ID</strong>.
        </p>
        <GuideImage
          src="/docs/guide/entra-3.png"
          alt="Step 1: Open Microsoft Entra ID from the Azure portal menu"
        />

        <h2>Step 2 — Start an app registration</h2>
        <p>
          On the Entra overview, click <strong>+ Add</strong>, then{" "}
          <strong>App registration</strong>.
        </p>
        <GuideImage
          src="/docs/guide/entra-5.png"
          alt="Step 2: Add → App registration on the Entra overview"
        />

        <h2>Step 3 — Register the application</h2>
        <p>Fill the form:</p>
        <ul>
          <li>
            <strong>Name</strong> — e.g. <code>DDA Parent Upload Portal</code>{" "}
            (display name only).
          </li>
          <li>
            <strong>Supported account types</strong> —{" "}
            <strong>
              Accounts in this organizational directory only (single tenant)
            </strong>
            . Organization-wide for your directory only — not multi-tenant.
          </li>
          <li>
            <strong>Redirect URI</strong> — Platform <strong>Web</strong>, URI:{" "}
            <code>{"{APP_URL}"}/api/auth/onedrive/callback</code>
            <br />
            Example:{" "}
            <code>
              https://upload.develop.bc.ca/api/auth/onedrive/callback
            </code>
          </li>
        </ul>
        <p>
          Click <strong>Register</strong>.
        </p>
        <GuideImage
          src="/docs/guide/entra-6.png"
          alt="Step 3: Register a single-tenant app with the OneDrive callback URI"
        />

        <h2>Step 4 — Add the second redirect URI</h2>
        <p>
          Under <strong>Manage</strong>, open <strong>Authentication</strong>.
          The OneDrive callback should already appear on the{" "}
          <strong>Web</strong> platform.
        </p>
        <GuideImage
          src="/docs/guide/entra-8.png"
          alt="Step 4a: Authentication showing the OneDrive redirect URI"
        />
        <p>
          Click <strong>+ Add Redirect URI</strong>, choose <strong>Web</strong>,
          and add:
        </p>
        <p>
          <code>{"{APP_URL}"}/api/auth/upload-access/callback</code>
          <br />
          Example:{" "}
          <code>
            https://upload.develop.bc.ca/api/auth/upload-access/callback
          </code>
        </p>
        <GuideImage
          src="/docs/guide/entra-9.png"
          alt="Step 4b: Select the Web platform for the second redirect URI"
        />
        <GuideImage
          src="/docs/guide/entra-10.png"
          alt="Step 4c: Configure the upload-access callback redirect URI"
        />
        <p>
          Click <strong>Configure</strong>. Authentication must list both:
        </p>
        <pre>
          <code>{`{APP_URL}/api/auth/onedrive/callback
{APP_URL}/api/auth/upload-access/callback`}</code>
        </pre>
        <GuideImage
          src="/docs/guide/entra-11.png"
          alt="Step 4d: Both Web redirect URIs registered"
        />

        <h2>Step 5 — API permissions (delegated)</h2>
        <p>
          Open <strong>API permissions</strong>. New registrations often already
          include Microsoft Graph <code>User.Read</code> (delegated). If it is
          missing: <strong>+ Add a permission</strong> →{" "}
          <strong>Microsoft Graph</strong> →{" "}
          <strong>Delegated permissions</strong> → select <code>User.Read</code>{" "}
          → <strong>Add permissions</strong>.
        </p>
        <GuideImage
          src="/docs/guide/entra-15.png"
          alt="Step 5: Add Microsoft Graph delegated permission User.Read"
        />

        <h2>Step 6 — API permissions (application)</h2>
        <p>
          Again: <strong>+ Add a permission</strong> →{" "}
          <strong>Microsoft Graph</strong> →{" "}
          <strong>Application permissions</strong>.
        </p>
        <GuideImage
          src="/docs/guide/entra-16.png"
          alt="Step 6a: Choose Application permissions for Microsoft Graph"
        />
        <p>
          Select <code>Sites.Selected</code> (Access selected site collections).
          Admin consent is required. Click <strong>Add permissions</strong>.
        </p>
        <GuideImage
          src="/docs/guide/entra-17.png"
          alt="Step 6b: Add Microsoft Graph application permission Sites.Selected"
        />
        <p>
          Add a second application permission the same way:{" "}
          <code>Sites.FullControl.All</code> (Have full control of all site
          collections). Admin consent is required.
        </p>

        <h2>Step 7 — Grant admin consent</h2>
        <p>
          On <strong>API permissions</strong>, click{" "}
          <strong>Grant admin consent for &lt;your org&gt;</strong> and confirm.
          Status for <code>Sites.Selected</code>,{" "}
          <code>Sites.FullControl.All</code>, and <code>User.Read</code> should
          show granted for the organization.
        </p>
        <GuideImage
          src="/docs/guide/entra-18.png"
          alt="Step 7a: Application permissions not yet granted — click Grant admin consent"
        />
        <GuideImage
          src="/docs/guide/entra-17b.png"
          alt="Step 7b: Admin consent granted for Sites.FullControl.All, Sites.Selected, and User.Read"
        />

        <h2>Step 8 — Create a client secret</h2>
        <p>
          Open <strong>Certificates &amp; secrets</strong> →{" "}
          <strong>Client secrets</strong> → <strong>+ New client secret</strong>.
          Set a description and expiry, then <strong>Add</strong>.
        </p>
        <GuideImage
          src="/docs/guide/entra-21.png"
          alt="Step 8a: Open New client secret"
        />
        <GuideImage
          src="/docs/guide/entra-22.png"
          alt="Step 8b: Add a client secret with description and expiry"
        />
        <p>
          Copy the secret <strong>Value</strong> immediately (shown once). Store
          it as <code>AZURE_CLIENT_SECRET</code>.
        </p>

        <h2>Step 9 — Copy IDs into environment variables</h2>
        <p>
          On the app registration <strong>Overview</strong>, copy:
        </p>
        <ul>
          <li>
            <strong>Application (client) ID</strong> →{" "}
            <code>NEXT_PUBLIC_AZURE_CLIENT_ID</code>
          </li>
          <li>
            <strong>Directory (tenant) ID</strong> →{" "}
            <code>AZURE_TENANT_ID</code> (when your host requires it)
          </li>
          <li>
            Client secret value → <code>AZURE_CLIENT_SECRET</code>
          </li>
        </ul>
        <p>
          Set <code>APP_URL</code> / <code>NEXT_PUBLIC_APP_URL</code> to the same
          origin used in redirect URIs (no trailing slash). On Cloudways Velocity,
          add these under Deployment Management → Settings — see{" "}
          <Link href="/docs/technical/cloudways-deploy">
            Cloudways deploy
          </Link>
          . Full variable list:{" "}
          <Link href="/docs/technical/environment-variables">
            Environment variables
          </Link>
          .
        </p>

        <h2>Step 10 — Connect the clinic OneDrive</h2>
        <p>
          Registration alone does not finish clinic setup. After env vars are
          deployed, an allowlisted admin signs in at <code>/console</code> and
          connects the receiving OneDrive — see{" "}
          <Link href="/docs/login">Login</Link>
          .
        </p>
      </DocArticle>
  );
}
