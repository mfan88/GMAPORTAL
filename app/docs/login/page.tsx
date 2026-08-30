import Link from "next/link";
import { DocArticle } from "@/components/docsChrome";
import { AccesstheConsoleWalkthrough } from "@/components/scribeComponents";

export default function LoginPage() {
  return (
    <DocArticle
      title="Login"
      lead="Sign in with an allowlisted Microsoft account to open the staff console."
    >
      <p>
        Go to{" "}
        <a href="https://upload.develop.bc.ca">upload.develop.bc.ca</a> and
        open the admin console at <code>/console</code>. Only emails listed
        under <strong>Allowed admin emails</strong> can sign in.
      </p>

      <h2>Walkthrough</h2>
      <AccesstheConsoleWalkthrough />

      <p>
        Next: <Link href="/docs/generate-a-link">Generate a link</Link>.
      </p>
    </DocArticle>
  );
}
