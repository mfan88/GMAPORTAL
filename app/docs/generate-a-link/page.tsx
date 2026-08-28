import Link from "next/link";
import { DocArticle } from "@/components/docsChrome";
import CreateLinkNowWalkthrough from "@/components/scribe/create-link-now";

export default function GenerateALinkPage() {
  return (
    <DocArticle
      title="Generate a link"
      lead="Follow these steps whenever a parent needs to send a GMA video."
    >
      <p>
        If OneDrive is not connected yet, finish{" "}
        <Link href="/docs/login-and-setup">Login and setup</Link> first. The
        admin console is at{" "}
        <a href="https://upload.develop.bc.ca/console">
          upload.develop.bc.ca/console
        </a>
        .
      </p>

      <h2>Walkthrough</h2>
      <p>
        Open the console, choose the child, generate the link, then copy it from{" "}
        <strong>Active Links</strong>. Names come from the reference Excel
        workbook in Settings. The URL looks like{" "}
        <code>https://upload.develop.bc.ca/link/…</code>
      </p>
      <CreateLinkNowWalkthrough />
      <p>
        Send that full URL to the parent through your usual clinic channel
        (secure messaging, email, SMS — whatever your clinic already uses).
      </p>

      <h2>What the parent experiences</h2>
      <ul>
        <li>
          If they open the link too early (during the short buffer), they see a
          countdown.
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
          If a link expires unused, generate a new one — don’t ask the parent to
          refresh an old link.
        </li>
        <li>
          If they say “it says used,” create a fresh link. The previous upload
          may have already completed.
        </li>
        <li>
          Use the <strong>X</strong> on a link row in Active Links when you no
          longer need that entry listed. Used and expired rows also leave the
          list on their own after one day.
        </li>
      </ul>
    </DocArticle>
  );
}
