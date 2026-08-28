import type { Metadata } from "next";
import Link from "next/link";
import SiteInfoShell from "@/components/siteInfoShell";
import {
  APP_DISPLAY_NAME,
  APP_SHORT_NAME,
  LEGAL_EFFECTIVE_DATE,
  PUBLISHER_CONTACT_EMAIL,
  PUBLISHER_NAME,
} from "@/lib/publisher";

export const metadata: Metadata = {
  title: `${APP_SHORT_NAME} — Privacy Statement`,
  description: `Privacy Statement for ${APP_DISPLAY_NAME}.`,
};

export default function PrivacyPage() {
  return (
    <SiteInfoShell title="Privacy Statement">
      <p className="text-sm text-black/60">
        Effective date: {LEGAL_EFFECTIVE_DATE}
      </p>

      <p>
        This Privacy Statement describes how {PUBLISHER_NAME} (&quot;we,&quot;
        &quot;us,&quot; or &quot;our&quot;) collects, uses, and shares
        information in connection with {APP_DISPLAY_NAME} (the
        &quot;Service&quot;).
      </p>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">
          1. Information we collect
        </h2>
        <p>Depending on how the Service is used, we may process:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Upload content:</strong> videos and related form details
            submitted through a clinic upload link (for example, child name and
            assessment-related dates).
          </li>
          <li>
            <strong>Administrator account information:</strong> Microsoft
            account identifiers and email address when a clinic administrator
            signs in to connect OneDrive or manage settings.
          </li>
          <li>
            <strong>Operational data:</strong> temporary upload-link tokens,
            link timing windows, configuration values, and basic technical logs
            needed to operate and secure the Service.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">
          2. How we use information
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            To receive and store assessment videos for review by authorized
            clinic staff and licensed physiotherapists.
          </li>
          <li>
            To authenticate clinic administrators and connect a receiving
            Microsoft OneDrive account via Microsoft Graph.
          </li>
          <li>To create, validate, and expire time-limited upload links.</li>
          <li>To maintain, secure, troubleshoot, and improve the Service.</li>
          <li>
            To respond to support requests sent to{" "}
            <a
              className="underline underline-offset-2"
              href={`mailto:${PUBLISHER_CONTACT_EMAIL}`}
            >
              {PUBLISHER_CONTACT_EMAIL}
            </a>
            .
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">
          3. How information is shared
        </h2>
        <p>
          We do not sell personal information. Information may be shared with:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>
              The clinic / Developmental Disabilities Association program:
            </strong>{" "}
            uploaded videos and related details are delivered to the
            clinic-managed OneDrive destination for assessment use.
          </li>
          <li>
            <strong>Microsoft:</strong> sign-in and file storage use Microsoft
            identity and Microsoft Graph / OneDrive. Microsoft processes that
            data under its own terms and privacy policy.
          </li>
          <li>
            <strong>Infrastructure providers:</strong> hosting, storage, and
            temporary link/config services used to run the Service.
          </li>
          <li>
            <strong>Legal requirements:</strong> if disclosure is required by
            law or necessary to protect rights, safety, or the integrity of the
            Service.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">4. Retention</h2>
        <p>
          Temporary upload links and related tokens are retained only as needed
          for the configured link window and Service operation. Videos and
          related records stored in the clinic OneDrive account are retained
          according to the clinic&apos;s own policies. Support emails are kept
          as long as needed to resolve the request.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">5. Security</h2>
        <p>
          We use reasonable administrative and technical measures appropriate to
          the Service, including authenticated administrator access and
          time-limited upload links. No method of transmission or storage is
          completely secure.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">
          6. Children&apos;s information
        </h2>
        <p>
          The Service is used in a clinical / program context and may process
          information about infants or children solely for assessment purposes
          when a family uses a clinic-issued upload link. Parents or guardians
          should only upload information they are authorized to share with the
          program.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">
          7. Your choices and requests
        </h2>
        <p>
          For access, correction, deletion, or other privacy requests related to
          the Service, contact{" "}
          <a
            className="underline underline-offset-2"
            href={`mailto:${PUBLISHER_CONTACT_EMAIL}`}
          >
            {PUBLISHER_CONTACT_EMAIL}
          </a>
          . Requests about clinical records stored in OneDrive may also need to
          be directed to the Developmental Disabilities Association or the
          clinic program that received the upload.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">
          8. Changes to this statement
        </h2>
        <p>
          We may update this Privacy Statement from time to time. The effective
          date above will be revised when material changes are posted to this
          page.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">9. Contact</h2>
        <p>
          {PUBLISHER_NAME}
          <br />
          Email:{" "}
          <a
            className="underline underline-offset-2"
            href={`mailto:${PUBLISHER_CONTACT_EMAIL}`}
          >
            {PUBLISHER_CONTACT_EMAIL}
          </a>
        </p>
        <p>
          See also our{" "}
          <Link href="/tos" className="underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/info" className="underline underline-offset-2">
            application home page
          </Link>
          .
        </p>
      </section>
    </SiteInfoShell>
  );
}
