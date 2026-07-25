import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    getPublicSiteOrigin,
    listLinks,
    removeUploadLink,
    toRequestShape,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    try {
        const origin = getPublicSiteOrigin(toRequestShape(request))
        const links = await listLinks()

        return NextResponse.json({
            links: links.map((link) => ({
                token: link.token,
                createdAt: link.createdAt,
                usedAt: link.usedAt,
                state: link.state,
                childName: link.childName,
                edc: link.edc,
                url: `${origin}/portalaccess/${link.token}`,
            })),
        })
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Could not load links"
        return NextResponse.json({ error: message, links: [] }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { token } = (await request.json()) as { token?: string }
        if (!token) {
            return NextResponse.json(
                { error: "A link token is required" },
                { status: 400 }
            )
        }

        await removeUploadLink(token)
        return NextResponse.json({ ok: true })
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Could not remove link"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
