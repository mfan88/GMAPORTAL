import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
    cookieHeaderFromStore,
    hasValidAdminAccess,
} from "@/lib/server/index"

export const dynamic = "force-dynamic"

export default async function SetupLayout({
    children,
}: Readonly<{ children: ReactNode }>) {
    // Console access is gated by the admin allowlist cookie (Microsoft User.Read).
    // The SharePoint site is a separate Sites.Selected destination.
    const cookieStore = await cookies()
    const cookieHeader = cookieHeaderFromStore(cookieStore)
    if (!(await hasValidAdminAccess(cookieHeader))) {
        redirect("/api/auth/admin/login")
    }

    return <>{children}</>
}
