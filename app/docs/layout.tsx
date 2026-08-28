import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Open_Sans } from "next/font/google";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DocsChrome } from "@/components/docsChrome";
import { cookieHeaderFromStore, hasValidAdminAccess } from "@/lib/server/index";

const docsSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "GMA Upload Portal docs",
    template: "%s · GMA Upload Portal docs",
  },
  description:
    "Internal documentation for the DDA GMA Parent Upload Portal — admin workflows and technical reference.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DocsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const cookieHeader = cookieHeaderFromStore(cookieStore);
  if (!(await hasValidAdminAccess(cookieHeader))) {
    const headerList = await headers();
    const pathname = headerList.get("x-pathname") ?? "/docs";
    const next =
      pathname === "/docs" || pathname.startsWith("/docs/")
        ? pathname
        : "/docs";
    redirect(`/api/auth/admin/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className={docsSans.className}>
      <DocsChrome>{children}</DocsChrome>
    </div>
  );
}
