"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const nav = [
  { href: "/docs", label: "Documentation home", exact: true },
  {
    heading: "Admin workflows",
    items: [
      { href: "/docs/login-and-setup", label: "Login and setup" },
      { href: "/docs/generate-a-link", label: "Generate a link" },
      { href: "/docs/change-settings", label: "Change settings" },
      { href: "/docs/after-an-upload", label: "After an upload" },
      { href: "/docs/for-parents", label: "For parents" },
    ],
  },
  {
    heading: "Technical",
    items: [
      { href: "/docs/technical", label: "Overview" },
      { href: "/docs/technical/entra-id-setup", label: "Entra ID setup" },
      { href: "/docs/technical/cloudways-deploy", label: "Cloudways deploy" },
      { href: "/docs/technical/architecture", label: "Architecture" },
      { href: "/docs/technical/api-reference", label: "API reference" },
      { href: "/docs/technical/configuration", label: "Configuration" },
      {
        href: "/docs/technical/environment-variables",
        label: "Environment variables",
      },
      { href: "/docs/technical/troubleshooting", label: "Troubleshooting" },
    ],
  },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-sm px-2.5 py-1.5 transition ${
        active
          ? "bg-[#E98300]/15 font-semibold text-[#02182B]"
          : "text-[#02182B]/70 hover:bg-[#02182B]/5 hover:text-[#02182B]"
      }`}
    >
      {label}
    </Link>
  );
}

function DocsNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Portal documentation" className="space-y-6 text-sm">
      {nav.map((block) => {
        if ("href" in block) {
          return (
            <NavLink
              key={block.href}
              href={block.href}
              label={block.label}
              active={isActive(pathname, block.href, block.exact)}
            />
          );
        }
        return (
          <div key={block.heading}>
            <p className="mb-2 px-2.5 text-[11px] font-semibold tracking-[0.16em] text-[#E98300] uppercase">
              {block.heading}
            </p>
            <ul className="space-y-0.5">
              {block.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    label={item.label}
                    active={isActive(pathname, item.href)}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function DocsChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/docs";

  return (
    <div className="min-h-screen bg-white text-[#02182B]">
      <header className="border-b border-[#02182B]/10 bg-white text-[#02182B]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/docs" className="block h-12 shrink-0 sm:h-14">
            <Image
              className="h-full w-auto"
              src="/images/dda-logo.svg"
              alt="Developmental Disabilities Association"
              width={1338}
              height={472}
              priority
            />
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/console"
              className="inline-flex items-center border border-[#E98300] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#02182B] uppercase hover:bg-[#E98300] hover:text-white sm:text-sm"
            >
              Open console
            </Link>
          </div>
        </div>
      </header>
      <div className="h-1 bg-[#E98300]" />

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <details className="lg:hidden">
            <summary className="cursor-pointer list-none rounded-sm border border-[#02182B]/15 px-3 py-2 text-sm font-semibold tracking-wide uppercase">
              In this guide
            </summary>
            <div className="mt-4">
              <DocsNav pathname={pathname} />
            </div>
          </details>
          <div className="hidden lg:block">
            <DocsNav pathname={pathname} />
          </div>
        </aside>

        <main className="min-w-0 pb-16">{children}</main>
      </div>
    </div>
  );
}

export function DocArticle({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <article className="max-w-3xl">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-[#02182B] md:text-4xl">
        {title}
      </h1>
      {lead ? (
        <p className="mt-3 text-base leading-relaxed text-[#02182B]/75 md:text-lg">
          {lead}
        </p>
      ) : null}
      <div className="docs-prose mt-8 space-y-5 text-[15px] leading-relaxed text-[#02182B]/80">
        {children}
      </div>
    </article>
  );
}

export function GuideImage({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- guide screenshots are static public files
    <img
      src={src}
      alt={alt}
      className="my-4 w-full rounded-sm border border-[#02182B]/10 bg-white shadow-sm"
    />
  );
}
