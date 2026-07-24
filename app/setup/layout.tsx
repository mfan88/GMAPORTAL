import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
    getOneDriveConnectionStatus,
    hasValidAdminAccess,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export default async function SetupLayout({
    children,
}: Readonly<{ children: ReactNode }>) {
    let requireAdmin = false
    try {
        const status = await getOneDriveConnectionStatus()
        requireAdmin = status.connected
    } catch {
        // If the connection status can't be read, keep the console reachable
        // so an admin can diagnose and reconnect.
        requireAdmin = false
    }

    if (requireAdmin) {
        const cookieStore = await cookies()
        if (!hasValidAdminAccess(cookieStore.toString())) {
            redirect("/api/auth/admin/login")
        }
    }

    return <>{children}</>
}
