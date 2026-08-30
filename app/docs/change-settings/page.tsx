import Link from "next/link";
import { DocArticle } from "@/components/docsChrome";
import {
  AddorRemoveAdminEmailWalkthrough,
  AddorRemoveNotificationEmailWalkthrough,
  ChangeLinkDurationsWalkthrough,
  ChangeReferenceWorkbookWalkthrough,
} from "@/components/scribeComponents";

export default function ChangeSettingsPage() {
  return (
    <DocArticle
      title="Change settings"
      lead="Use this when you need to change the child list workbook, link timing, who can administer the portal, or who gets upload emails."
    >
      <p>
        Open{" "}
        <a href="https://upload.develop.bc.ca/console">
          upload.develop.bc.ca/console
        </a>{" "}
        and sign in if needed. Click <strong>Change</strong> in Settings before
        you edit fields.
      </p>

      <h2>Walkthroughs</h2>
      <div className="space-y-3">
        <ChangeReferenceWorkbookWalkthrough />
        <ChangeLinkDurationsWalkthrough />
        <AddorRemoveAdminEmailWalkthrough />
        <AddorRemoveNotificationEmailWalkthrough />
      </div>

      <p>
        Back to <Link href="/docs/generate-a-link">Generate a link</Link> when
        you are ready to send a parent upload URL.
      </p>
    </DocArticle>
  );
}
