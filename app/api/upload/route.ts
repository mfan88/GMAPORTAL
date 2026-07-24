import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    uploadSmallFileToOneDrive,
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
        const formData = await request.formData()
        const file = formData.get("file")

        if (!(file instanceof File)) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            )
        }

        const accessToken = await getOneDriveAccessToken()
        const result = await uploadSmallFileToOneDrive(file, accessToken)

        return NextResponse.json(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
