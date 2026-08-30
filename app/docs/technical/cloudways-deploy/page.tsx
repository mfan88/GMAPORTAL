import Link from "next/link";
import {
  DocArticle,
  GuideImage,
} from "@/components/docsChrome";

export default function CloudwaysDeployPage() {
  return (
    <DocArticle
        title="Cloudways Velocity deploy"
        lead="Add Entra / Azure environment variables on the Cloudways Velocity Node.js app (gmaportal) and redeploy so the portal can use the app registration from Entra ID setup."
      >
        <p>
          Screenshots use the <strong>gmaportal</strong> Velocity app that serves{" "}
          <code>upload.develop.bc.ca</code>. Substitute your app name and values.
          Complete{" "}
          <Link href="/docs/technical/entra-id-setup">
            Entra ID setup
          </Link>{" "}
          first so you have the client ID, tenant ID, and client secret ready.
        </p>
        <p>
          Mark secrets as <strong>Sensitive</strong> when Cloudways offers the
          toggle. Do not paste live secret values into docs or tickets.
        </p>

        <h2>Step 1 — Open Velocity applications</h2>
        <p>
          In Cloudways, open <strong>Velocity</strong> →{" "}
          <strong>My Applications</strong>.
        </p>
        <GuideImage
          src="/docs/guide/cloudways-2.png"
          alt="Step 1: Cloudways Velocity — My Applications"
        />

        <h2>Step 2 — Open the portal app</h2>
        <p>
          Select the Node.js app for this deployment (example:{" "}
          <strong>gmaportal</strong>).
        </p>
        <GuideImage
          src="/docs/guide/cloudways-3.png"
          alt="Step 2: Open the gmaportal Velocity application"
        />

        <h2>Step 3 — Open Deployment Management</h2>
        <p>
          From the app <strong>Overview</strong>, open{" "}
          <strong>Deployment Management</strong> in the left menu.
        </p>
        <GuideImage
          src="/docs/guide/cloudways-4.png"
          alt="Step 3: App Overview — open Deployment Management"
        />

        <h2>Step 4 — Open Settings</h2>
        <p>
          On the Deployment Manager, open the <strong>Settings</strong> tab
          (build config and environment variables live here).
        </p>
        <GuideImage
          src="/docs/guide/cloudways-5.png"
          alt="Step 4a: Deployment Manager — open Settings"
        />
        <GuideImage
          src="/docs/guide/cloudways-11.png"
          alt="Step 4b: Settings — build config and environment variables"
        />

        <h2>Step 5 — Add Entra environment variables</h2>
        <p>
          Under <strong>Environmental Variables</strong>, click{" "}
          <strong>+ Add Variable</strong>. Add these keys from the Entra app
          registration (values from your tenant — not from screenshots):
        </p>
        <ul>
          <li>
            <code>NEXT_PUBLIC_AZURE_CLIENT_ID</code> — Application (client) ID
          </li>
          <li>
            <code>AZURE_TENANT_ID</code> — Directory (tenant) ID
          </li>
          <li>
            <code>AZURE_CLIENT_SECRET</code> — client secret{" "}
            <strong>Value</strong> (turn <strong>Sensitive</strong> on)
          </li>
        </ul>
        <p>
          You should already have <code>APP_URL</code> /{" "}
          <code>NEXT_PUBLIC_APP_URL</code> and other host vars set. Full list:{" "}
          <Link href="/docs/technical/environment-variables">
            Environment variables
          </Link>
          .
        </p>
        <GuideImage
          src="/docs/guide/cloudways-10.png"
          alt="Step 5a: Add NEXT_PUBLIC_AZURE_CLIENT_ID"
        />
        <GuideImage
          src="/docs/guide/cloudways-9.png"
          alt="Step 5b: Add AZURE_TENANT_ID"
        />
        <GuideImage
          src="/docs/guide/cloudways-8.png"
          alt="Step 5c: Add AZURE_CLIENT_SECRET as Sensitive"
        />
        <p>
          After save, sensitive values show as <strong>Sensitive</strong> in the
          list and cannot be viewed again — keep a copy in your secrets store.
        </p>
        <GuideImage
          src="/docs/guide/cloudways-7.png"
          alt="Step 5d: AZURE_CLIENT_SECRET saved as Sensitive"
        />

        <h2>Step 6 — Save and redeploy</h2>
        <p>
          Click <strong>Save &amp; Redeploy</strong> (or save, then open the{" "}
          <strong>Deployments</strong> tab and <strong>Redeploy</strong>) so the
          new variables apply to build and runtime.
        </p>
        <GuideImage
          src="/docs/guide/cloudways-12.png"
          alt="Step 6: Redeploy from the Deployments tab"
        />

        <h2>Next</h2>
        <p>
          Confirm the live site loads, then finish clinic connection in{" "}
          <Link href="/docs/login">Login</Link>
          .
        </p>
      </DocArticle>
  );
}
