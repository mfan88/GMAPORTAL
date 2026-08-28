import Link from "next/link";
import { DocArticle } from "@/components/docsChrome";

const workflows = [
  {
    href: "/docs/login-and-setup",
    title: "Login and setup",
    body: "Sign in with Microsoft, connect the receiving OneDrive, and verify Current Status is Active.",
  },
  {
    href: "/docs/generate-a-link",
    title: "Generate a link",
    body: "Pick a child, create a one-time parent link, and copy it from Active Links.",
  },
  {
    href: "/docs/change-settings",
    title: "Change settings",
    body: "Update the upload folder, reference workbook, link timing, and allowed admin emails.",
  },
];

export default function DdaHomePage() {
  return (
    <DocArticle
        title="GMA Parent Upload Portal (DDA)"
        lead="Internal guides for Developmental Disabilities Association clinic staff and maintainers. Only allowlisted administrators can open these pages."
      >
        <p>
          Open the{" "}
          <Link href="/console">admin console</Link> to generate parent links and
          change settings.
        </p>

        <h2>Admin workflows</h2>
        <div className="not-prose grid gap-3">
          {workflows.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-sm border border-[#02182B]/15 bg-white p-4 transition hover:border-[#E98300]"
            >
              <p className="font-semibold text-[#02182B]">{item.title}</p>
              <p className="mt-1 text-sm text-[#02182B]/70">{item.body}</p>
            </Link>
          ))}
        </div>

        <h2>Also in this section</h2>
        <ul>
          <li>
            <Link href="/docs/after-an-upload">
              After an upload
            </Link>{" "}
            — what staff do when a video arrives
          </li>
          <li>
            <Link href="/docs/for-parents">For parents</Link>{" "}
            — what to tell families who received a link
          </li>
          <li>
            <Link href="/docs/technical">
              Technical reference
            </Link>{" "}
            — architecture, APIs, Redis, Azure, and configuration for this
            deployment
          </li>
        </ul>
      </DocArticle>
  );
}
