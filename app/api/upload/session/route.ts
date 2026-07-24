import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    assertValidUploadSize,
    createOneDriveUploadSession,
    sanitizeUploadFilename,
    getAppConfig,
    getOneDriveAccessToken,
    canAccessUploadPortal,
    toRequestShape,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
    const access = await canAccessUploadPortal(toRequestShape(request))
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
        }

        if (typeof body.filename !== "string") {
            return NextResponse.json(
                { error: "Filename is required" },
                { status: 400 }
            )
        }

        const filename = sanitizeUploadFilename(body.filename)
        await assertValidUploadSize(Number(body.fileSize))

        const accessToken = await getOneDriveAccessToken()
        const [session, config] = await Promise.all([
            createOneDriveUploadSession(accessToken, filename),
            getAppConfig(),
        ])

        return NextResponse.json({
            ...session,
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
