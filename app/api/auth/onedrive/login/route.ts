import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    getOneDriveLoginUrl,
    authFlowCookieHeader,
    clearOneDriveConnection,
    createPkcePair,
    hasValidAdminAccess,
    pkceCookieHeader,
    toRequestShape,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    if (!(await hasValidAdminAccess(request.headers.get("cookie") ?? undefined))) {
        return NextResponse.redirect(
            new URL("/api/auth/admin/login", request.url),
            { status: 307 }
        )
    }

    try {
        // Start "Change receiving OneDrive" from a clean slate so the upcoming
        // Microsoft account is the only one stored after callback.
        await clearOneDriveConnection()

        const { verifier, challenge } = createPkcePair()
        const loginUrl = await getOneDriveLoginUrl(
            challenge,
            toRequestShape(request)
        )

        const response = NextResponse.redirect(loginUrl, { status: 307 })
        response.headers.append("Set-Cookie", pkceCookieHeader(verifier))
        response.headers.append("Set-Cookie", authFlowCookieHeader("setup"))
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
