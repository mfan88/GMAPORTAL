import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    checkUploadLink,
    createPortalAccessCookieHeader,
    publicUrl,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export async function GET(
    request: NextRequest,
    ctx: { params: Promise<{ token: string }> }
) {
    const { token } = await ctx.params
    const redirectTo = (reason?: string, availableAt?: number) => {
        const url = publicUrl("/link-expired", request)
        if (reason) url.searchParams.set("reason", reason)
        if (typeof availableAt === "number") {
            url.searchParams.set("availableAt", String(availableAt))
        }
        if (token) url.searchParams.set("token", token)
        return NextResponse.redirect(url, { status: 307 })
    }

    if (!token) return redirectTo()

    try {
        // Grant access without consuming the link. The link is consumed only
        // after a successful upload (see /api/upload/complete).
        const result = await checkUploadLink(token)

        if (result.status === "pending") {
            return redirectTo("pending", result.availableAt)
        }
        if (result.status !== "active") {
            return redirectTo()
        }

        const response = NextResponse.redirect(publicUrl("/", request), {
            status: 307,
        })
        response.headers.append(
            "Set-Cookie",
            createPortalAccessCookieHeader(token)
        )
        return response
    } catch (error) {
        console.error("Portal access token check failed:", error)
        return redirectTo()
    }
}
