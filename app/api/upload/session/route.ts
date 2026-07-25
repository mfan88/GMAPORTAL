import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    assertValidUploadSize,
    createOneDriveUploadSession,
    getAppConfig,
    getOneDriveAccessToken,
    canAccessUploadPortal,
    resolvePortalUploadFilename,
    toRequestShape,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
    const shaped = toRequestShape(request)
    const access = await canAccessUploadPortal(shaped)
    if (!access.allowed) {
        return NextResponse.json(
            {
                error: "Upload access required. Use a parent link or sign in with the receiving OneDrive account.",
            },
            { status: 401 }
        )
    }

    try {
        const body = (await request.json()) as {
            filename?: string
            fileSize?: number
            dateRecorded?: string
        }

        if (typeof body.filename !== "string") {
            return NextResponse.json(
                { error: "Filename is required" },
                { status: 400 }
            )
        }
        if (typeof body.dateRecorded !== "string" || !body.dateRecorded.trim()) {
            return NextResponse.json(
                { error: "Date recorded is required" },
                { status: 400 }
            )
        }

        const filename = await resolvePortalUploadFilename(
            shaped,
            body.dateRecorded,
            body.filename
        )
        await assertValidUploadSize(Number(body.fileSize))

        const accessToken = await getOneDriveAccessToken()
        const [session, config] = await Promise.all([
            createOneDriveUploadSession(accessToken, filename),
            getAppConfig(),
        ])

        return NextResponse.json({
            ...session,
            filename,
            uploadChunkSizeBytes: config.fileDetails.uploadChunkSizeBytes,
        })
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Could not create upload session"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
