import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    getUploadAccessLoginUrl,
    authFlowCookieHeader,
    createPkcePair,
    pkceCookieHeader,
    toRequestShape,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    try {
        const { verifier, challenge } = createPkcePair()
        // Do not pass a loginHint tied to the OneDrive receiving account —
        // any allowlisted admin should be able to pick their own Microsoft account.
        const loginUrl = await getUploadAccessLoginUrl(
            challenge,
            toRequestShape(request)
        )

        const response = NextResponse.redirect(loginUrl, { status: 307 })
        response.headers.append("Set-Cookie", pkceCookieHeader(verifier))
        response.headers.append("Set-Cookie", authFlowCookieHeader("admin"))
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
