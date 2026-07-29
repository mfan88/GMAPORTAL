import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { PUBLISHER_CONTACT_EMAIL, PUBLISHER_NAME } from "@/lib/publisher"

const navLinks = [
  { href: "/info", label: "Home" },
  { href: "/privacy", label: "Privacy" },
  { href: "/tos", label: "Terms" },
] as const

export default function SiteInfoShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen w-full bg-white text-black">
      <header className="box-border flex flex-wrap items-center justify-between gap-4 border-b border-black/10 px-4 py-3">
        <Link href="/info" className="block h-14 shrink-0">
          <Image
            className="h-full w-auto"
            src="/images/dda-logo.svg"
            alt="Developmental Disabilities Association"
            width={1338}
            height={472}
            priority
          />
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-heading text-3xl font-medium tracking-tight">
          {title}
        </h1>
        <div className="mt-8 space-y-6 text-base leading-relaxed text-black/90">
          {children}
        </div>
      </main>

      <footer className="mx-auto max-w-3xl border-t border-black/10 px-4 py-8 text-sm text-black/70">
        <p>{PUBLISHER_NAME}</p>
        <p className="mt-1">
          Contact:{" "}
          <a
            className="underline underline-offset-2"
            href={`mailto:${PUBLISHER_CONTACT_EMAIL}`}
          >
            {PUBLISHER_CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-4 flex flex-wrap gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="underline underline-offset-2"
            >
              {link.label}
            </Link>
          ))}
        </p>
      </footer>
    </div>
  )
}
