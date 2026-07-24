import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    getAppConfig,
    linkExpirySeconds,
    getPublicSiteOrigin,
    createUploadLink,
    toRequestShape,
    hasValidAdminAccess,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
    if (!(await hasValidAdminAccess(request.headers.get("cookie") ?? undefined))) {
        return NextResponse.json(
            { error: "Admin access required" },
            { status: 401 }
        )
    }

    try {
        const body = (await request.json()) as {
            childName?: string
            ageWeeks?: number
        }

        const childName =
            typeof body.childName === "string" ? body.childName.trim() : ""
        const ageWeeks =
            typeof body.ageWeeks === "number" ? body.ageWeeks : Number.NaN

        if (!childName) {
            return NextResponse.json(
                { error: "Select a child before generating a link." },
                { status: 400 }
            )
        }
        if (!Number.isFinite(ageWeeks) || ageWeeks < 0) {
            return NextResponse.json(
                {
                    error:
                        "This child needs a valid EDC date before a link can be generated.",
                },
                { status: 400 }
            )
        }

        const [{ token, createdAt, childName: storedName, ageWeeks: storedAge }, config] =
            await Promise.all([
                createUploadLink({
                    childName,
                    ageWeeks: Math.floor(ageWeeks),
                }),
                getAppConfig(),
            ])
        const origin = getPublicSiteOrigin(toRequestShape(request))
        const url = `${origin}/portalaccess/${token}`

        return NextResponse.json({
            token,
            url,
            createdAt,
            childName: storedName,
            ageWeeks: storedAge,
            expiresInSeconds: linkExpirySeconds(config),
        })
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Could not generate link"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
