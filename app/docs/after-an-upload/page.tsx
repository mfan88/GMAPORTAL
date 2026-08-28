import { DocArticle } from "@/components/docsChrome";

export default function AfterAnUploadPage() {
  return (
    <DocArticle
        title="After an upload"
        lead="What clinic staff should do when a parent finishes sending a GMA video."
      >
        <h2>What staff should do</h2>
        <ol>
          <li>
            Check email for a subject like:{" "}
            <strong>
              <code>
                {"{ChildName}'s parent has uploaded a new video to your OneDrive"}
              </code>
            </strong>
          </li>
          <li>
            Open the OneDrive link in the email, <strong>or</strong> browse the
            configured upload folder in OneDrive.
          </li>
          <li>
            In the admin console, the used link stays in Active Links for one
            day, then drops off on its own. You can still remove it sooner with
            the X.
          </li>
        </ol>

        <h2>What the file is named</h2>
        <p>Files are named automatically, roughly like:</p>
        <p>
          <code>{`GMA Video {Child Name} {DD.MM.YYYY}_{ageWeeks}.mp4`}</code>
        </p>
        <ul>
          <li>Child name and EDC come from the link the clinic created</li>
          <li>The recording date comes from what the parent entered</li>
          <li>
            Age in weeks is calculated on the server from EDC → recording date
          </li>
        </ul>
        <p>Parents do not need to name the file themselves.</p>

        <h2>If the email never arrives</h2>
        <p>
          The upload can still succeed even if email delivery has a problem.
          Check the OneDrive folder first. Then ask a technical contact to
          verify email settings (Azure Communication Services).
        </p>
      </DocArticle>
  );
}
