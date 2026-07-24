import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
    cookieHeaderFromStore,
    hasValidAdminAccess,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export default async function SetupLayout({
    children,
}: Readonly<{ children: ReactNode }>) {
    // Console access is always gated by the admin allowlist. The connected
    // OneDrive account is only the upload destination and can be different.
    const cookieStore = await cookies()
    const cookieHeader = cookieHeaderFromStore(cookieStore)
    if (!(await hasValidAdminAccess(cookieHeader))) {
        redirect("/api/auth/admin/login")
    }

    return <>{children}</>
}
