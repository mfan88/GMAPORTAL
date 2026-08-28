import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    getConnectedOneDriveAccount,
    getUploadAccessLoginUrl,
    authFlowCookieHeader,
    createPkcePair,
    pkceCookieHeader,
    toRequestShape,
} from "@/lib/server/index"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    try {
        const connectedAccount = await getConnectedOneDriveAccount()
        const { verifier, challenge } = createPkcePair()
        const loginUrl = await getUploadAccessLoginUrl(
            challenge,
            toRequestShape(request),
            connectedAccount?.username ?? undefined
        )

        const response = NextResponse.redirect(loginUrl, { status: 307 })
        response.headers.append("Set-Cookie", pkceCookieHeader(verifier))
        response.headers.append(
            "Set-Cookie",
            authFlowCookieHeader("upload-access")
        )
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
