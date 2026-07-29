import type { Metadata } from "next"
import Link from "next/link"
import SiteInfoShell from "@/components/siteInfoShell"
import {
  APP_DISPLAY_NAME,
  APP_SHORT_NAME,
  PUBLISHER_CONTACT_EMAIL,
  PUBLISHER_NAME,
} from "@/lib/publisher"

export const metadata: Metadata = {
  title: `${APP_SHORT_NAME} — Home`,
  description:
    "Official information site for the DDAGMA GMA video upload portal used by the Vancouver Infant Development Program.",
}

export default function InfoHomePage() {
  return (
    <SiteInfoShell title={APP_DISPLAY_NAME}>
      <p>
        {APP_SHORT_NAME} is a secure video upload application for the Vancouver
        Infant Development Program. It helps families share General Movements
        Assessment (GMA) videos with licensed physiotherapists for assessment
        purposes.
      </p>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">What the app does</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Clinic staff create time-limited upload links for families.
          </li>
          <li>
            Families upload a GMA video and related child information through
            the portal.
          </li>
          <li>
            Uploaded files are delivered to a clinic-managed Microsoft OneDrive
            account using Microsoft Graph.
          </li>
          <li>
            Clinic administrators sign in with Microsoft to configure the
            receiving OneDrive account and portal settings.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">Publisher</h2>
        <p>{PUBLISHER_NAME}</p>
        <p>
          Questions or support requests:{" "}
          <a
            className="underline underline-offset-2"
            href={`mailto:${PUBLISHER_CONTACT_EMAIL}`}
          >
            {PUBLISHER_CONTACT_EMAIL}
          </a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">Legal</h2>
        <p>
          Please review our{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Statement
          </Link>{" "}
          and{" "}
          <Link href="/tos" className="underline underline-offset-2">
            Terms of Service
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">
          Microsoft identity &amp; Graph access
        </h2>
        <p>
          This application requests Microsoft account sign-in and Microsoft
          Graph permissions so clinic administrators can connect a OneDrive
          destination and so authorized uploads can be stored there. Use of
          Microsoft services is also subject to Microsoft&apos;s own terms and
          privacy policies.
        </p>
      </section>
    </SiteInfoShell>
  )
}
