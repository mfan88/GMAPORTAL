import type { Metadata } from "next"
import Link from "next/link"
import SiteInfoShell from "@/components/siteInfoShell"
import {
  APP_DISPLAY_NAME,
  APP_SHORT_NAME,
  LEGAL_EFFECTIVE_DATE,
  PUBLISHER_CONTACT_EMAIL,
  PUBLISHER_NAME,
} from "@/lib/publisher"

export const metadata: Metadata = {
  title: `${APP_SHORT_NAME} — Terms of Service`,
  description: `Terms of Service for ${APP_DISPLAY_NAME}.`,
}

export default function TermsOfServicePage() {
  return (
    <SiteInfoShell title="Terms of Service">
      <p className="text-sm text-black/60">
        Effective date: {LEGAL_EFFECTIVE_DATE}
      </p>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern access to and use of{" "}
        {APP_DISPLAY_NAME} (the &quot;Service&quot;), provided by{" "}
        {PUBLISHER_NAME} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
        By using the Service, you agree to these Terms.
      </p>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">1. The Service</h2>
        <p>
          The Service provides time-limited video upload links and related
          tools so families can share General Movements Assessment (GMA)
          videos with clinic staff, and so authorized administrators can
          connect a Microsoft OneDrive destination and manage portal settings.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">2. Eligibility &amp; accounts</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Families may use an upload link only if they received a valid,
            unexpired link from the clinic program.
          </li>
          <li>
            Clinic administrators must sign in with an authorized Microsoft
            account and use the Service only for legitimate program purposes.
          </li>
          <li>
            You are responsible for activity under your credentials and for
            keeping access to admin accounts secure.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Upload content you are not authorized to share, or use the Service
            for unlawful, harmful, or abusive purposes.
          </li>
          <li>
            Attempt to bypass link expiration, access controls, or
            authentication.
          </li>
          <li>
            Interfere with the Service, probe it for vulnerabilities without
            authorization, or misuse Microsoft Graph / OneDrive access.
          </li>
          <li>
            Misrepresent your identity or affiliation when using administrator
            features.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">4. Uploaded content</h2>
        <p>
          Uploaders retain any rights they have in submitted videos and form
          information, and grant the clinic program and us a limited right to
          receive, transmit, store, and process that content solely to operate
          the Service and enable assessment use. Clinical use and retention of
          uploaded materials in OneDrive are governed by the clinic
          program&apos;s policies.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">
          5. Microsoft services
        </h2>
        <p>
          Parts of the Service rely on Microsoft identity, Microsoft Graph, and
          OneDrive. Your use of those Microsoft services is also subject to
          Microsoft&apos;s applicable terms and privacy policy. We are not
          responsible for outages or changes made by Microsoft.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">
          6. No medical advice
        </h2>
        <p>
          The Service is a technical upload and administration tool. It does
          not provide medical advice, diagnosis, or treatment. Assessment
          decisions are made by qualified clinicians, not by the software
          publisher.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">
          7. Disclaimer of warranties
        </h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as
          available&quot; without warranties of any kind, whether express or
          implied, including merchantability, fitness for a particular purpose,
          and non-infringement, to the maximum extent permitted by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">
          8. Limitation of liability
        </h2>
        <p>
          To the maximum extent permitted by law, {PUBLISHER_NAME} will not be
          liable for any indirect, incidental, special, consequential, or
          punitive damages, or any loss of data, profits, or business, arising
          from or related to your use of the Service. Our aggregate liability
          for claims relating to the Service will not exceed CAD $100.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">9. Suspension</h2>
        <p>
          We may suspend or restrict access to the Service if we reasonably
          believe these Terms are being violated, if required for security or
          legal reasons, or if the Service is discontinued.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">10. Changes</h2>
        <p>
          We may update these Terms by posting a revised version on this page
          with an updated effective date. Continued use after changes become
          effective constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">11. Contact</h2>
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
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Statement
          </Link>{" "}
          and{" "}
          <Link href="/info" className="underline underline-offset-2">
            application home page
          </Link>
          .
        </p>
      </section>
    </SiteInfoShell>
  )
}
