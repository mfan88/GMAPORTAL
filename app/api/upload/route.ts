import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    uploadSmallFileToOneDrive,
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
        const formData = await request.formData()
        const file = formData.get("file")
        const dateRecorded = formData.get("dateRecorded")

        if (!(file instanceof File)) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            )
        }
        if (typeof dateRecorded !== "string" || !dateRecorded.trim()) {
            return NextResponse.json(
                { error: "Date recorded is required" },
                { status: 400 }
            )
        }

        const filename = await resolvePortalUploadFilename(
            shaped,
            dateRecorded,
            file.name
        )
        const namedFile = new File([file], filename, {
            type: file.type,
            lastModified: file.lastModified,
        })

        const accessToken = await getOneDriveAccessToken()
        const result = await uploadSmallFileToOneDrive(namedFile, accessToken)

        return NextResponse.json(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
