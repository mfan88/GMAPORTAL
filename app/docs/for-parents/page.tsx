import Link from "next/link";
import { DocArticle } from "@/components/docsChrome";

export default function ForParentsPage() {
  return (
    <DocArticle
        title="For parents"
        lead="Share this with families who received a private upload link from the clinic."
      >
        <h2>What you need</h2>
        <ul>
          <li>The link the clinic sent you</li>
          <li>The video of your child on your phone or computer</li>
          <li>The date that video was recorded</li>
        </ul>
        <p>
          You do <strong>not</strong> need a password, an app download, or a
          Microsoft account.
        </p>

        <h2>Steps</h2>
        <ol>
          <li>Tap or open the link.</li>
          <li>
            If you see a short countdown, wait — the link is still getting
            ready.
          </li>
          <li>
            Choose the <strong>date recorded</strong>.
          </li>
          <li>
            Tap <strong>Add video</strong> (on a phone) or drag the file in (on
            a computer).
          </li>
          <li>
            Wait until the upload finishes and you see a success message.
          </li>
        </ol>
        <p>That’s all. You can close the page.</p>

        <h2>Common questions</h2>
        <h3>The page says the link is expired or already used</h3>
        <p>
          Ask the clinic for a new link. Each link is meant to be used once, and
          only for a limited time.
        </p>

        <h3>The upload button stays grey / disabled</h3>
        <p>
          Make sure you picked a recording date first. The page needs that date
          before it can start.
        </p>

        <h3>Can I upload more than one video?</h3>
        <p>
          The portal is set up for <strong>one video per link</strong>. If the
          clinic needs another recording, they will send another link.
        </p>

        <h3>Is this safe?</h3>
        <p>
          The link is private and temporary. After a successful upload, it stops
          working. The video goes to the clinic’s own OneDrive — not a public
          website.
        </p>
        <p>
          Questions: ask the clinic that sent your link, or email{" "}
          <a href="mailto:support@marcusfan.dev">support@marcusfan.dev</a>. Product
          privacy and terms:{" "}
          <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/tos">Terms of service</Link>.
        </p>
      </DocArticle>
  );
}
