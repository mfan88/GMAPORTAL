import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    consumeUploadLink,
    canAccessUploadPortal,
    clearUploadAccessCookieHeader,
    getPortalAccessTokenFromRequest,
    toRequestShape,
} from "@/lib/server"

export const dynamic = "force-dynamic"

/**
 * Called by the client after an upload completes successfully. This consumes the
 * parent's single-use link and revokes their session cookie, so each link is
 * good for exactly one successful upload.
 */
export async function POST(request: NextRequest) {
    const shaped = toRequestShape(request)

    const access = await canAccessUploadPortal(shaped)
    if (!access.allowed) {
        return NextResponse.json(
            { error: "Upload access required." },
            { status: 401 }
        )
    }

    const token = getPortalAccessTokenFromRequest(shaped)

    // Admins (no bound link) keep their access; nothing to consume.
    if (!token) {
        return NextResponse.json({ ok: true })
    }

    try {
        await consumeUploadLink(token)
    } catch (error) {
        console.error("Failed to consume upload link:", error)
    }

    const response = NextResponse.json({ ok: true })
    response.headers.append("Set-Cookie", clearUploadAccessCookieHeader())
    return response
}
