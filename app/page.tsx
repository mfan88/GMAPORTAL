import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PARENT_UPLOAD_PATH } from "@/lib/parentLink";
import { APP_DISPLAY_NAME, PUBLISHER_CONTACT_EMAIL } from "@/lib/publisher";
import {
  cookieHeaderFromStore,
  getPortalAccessTokenFromRequest,
  uploadLinkUsable,
} from "@/lib/server/index";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "General Movement Assessment Video Upload",
  description:
    "Private GMA video upload portal for the Vancouver Infant Development Program at the Developmental Disabilities Association.",
};

export default async function HomePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ needLink?: string | string[] }>;
}>) {
  const cookieStore = await cookies();
  const cookieHeader = cookieHeaderFromStore(cookieStore);
  const token = getPortalAccessTokenFromRequest({
    headers: { cookie: cookieHeader },
  });
  if (token && (await uploadLinkUsable(token))) {
    redirect(PARENT_UPLOAD_PATH);
  }

  const params = await searchParams;
  const needLink = Array.isArray(params.needLink)
    ? params.needLink[0]
    : params.needLink;

  return (
    <div className="min-h-dvh bg-white text-[#02182B]">
      <header className="border-b border-[#02182B]/10">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="block h-12 sm:h-14">
            <Image
              className="h-full w-auto"
              src="/images/dda-logo.svg"
              alt="Developmental Disabilities Association"
              width={1338}
              height={472}
              priority
            />
          </Link>
          <Link
            href="/console"
            className="inline-flex items-center rounded-full border border-[#E98300] px-4 py-1.5 text-xs font-semibold tracking-wide uppercase hover:bg-[#E98300] hover:text-white sm:text-sm"
          >
            Staff sign in
          </Link>
        </div>
      </header>
      <div className="h-1 bg-[#E98300]" />

      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm font-semibold tracking-[0.16em] text-[#E98300] uppercase">
          Vancouver Infant Development Program
        </p>
        <h1 className="font-heading mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          General Movement Assessment Video Upload
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#02182B]/80 sm:text-lg">
          Families share a General Movements Assessment video with the clinic
          through a private, one-time link. There is nothing to upload from this
          page.
        </p>

        {needLink ? (
          <p className="mt-6 rounded-sm border border-[#E98300]/40 bg-[#E98300]/10 px-4 py-3 text-sm leading-relaxed">
            The upload form is only available from the temporary link the clinic
            sent you. Open that full link on this device. If you do not have
            one, ask the clinic for a new invitation.
          </p>
        ) : null}

        <section className="mt-10 space-y-3">
          <h2 className="font-heading text-xl font-semibold">For families</h2>
          <p className="leading-relaxed text-[#02182B]/80">
            Use the link in the message from your clinic. It opens a short
            upload page, works once, and then stops. You do not need an account
            or an app.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="font-heading text-xl font-semibold">For clinic staff</h2>
          <p className="leading-relaxed text-[#02182B]/80">
            Sign in with an allowlisted Microsoft work account to create parent
            links and manage settings.
          </p>
          <Link
            href="/console"
            className="inline-flex items-center rounded-full bg-[#02182B] px-5 py-2 text-sm font-semibold tracking-wide text-white uppercase hover:bg-[#02182B]/90"
          >
            Open console
          </Link>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-3xl border-t border-[#02182B]/10 px-4 py-8 text-sm text-[#02182B]/70 sm:px-6">
        <p>{APP_DISPLAY_NAME}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/info" className="underline underline-offset-2">
            About
          </Link>
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
          <Link href="/tos" className="underline underline-offset-2">
            Terms
          </Link>
          <a
            className="underline underline-offset-2"
            href={`mailto:${PUBLISHER_CONTACT_EMAIL}`}
          >
            {PUBLISHER_CONTACT_EMAIL}
          </a>
        </p>
      </footer>
    </div>
  );
}
