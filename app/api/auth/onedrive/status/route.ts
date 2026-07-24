import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    getOneDriveRedirectUri,
    getRegisteredRedirectUris,
    getUploadAccessRedirectUri,
    clearOneDriveConnection,
    getOneDriveConnectionStatus,
    getBlobAuthMode,
    getTokenStorageDescription,
    usesBlobTokenStore,
    clearUploadAccessCookieHeader,
    toRequestShape,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    const shaped = toRequestShape(request)

    try {
        const status = await getOneDriveConnectionStatus()

        return NextResponse.json({
            ...status,
            redirectUri: getOneDriveRedirectUri(shaped),
            uploadAccessRedirectUri: getUploadAccessRedirectUri(shaped),
            redirectUris: getRegisteredRedirectUris(),
            tokenStorage: getTokenStorageDescription(),
            blobConfigured: usesBlobTokenStore(),
            blobAuth: getBlobAuthMode(),
        })
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Could not read OneDrive status"
        return NextResponse.json(
            { connected: false, username: null, error: message },
            { status: 200 }
        )
    }
}

export async function DELETE() {
    await clearOneDriveConnection()
    const response = NextResponse.json({ connected: false })
    response.headers.append("Set-Cookie", clearUploadAccessCookieHeader())
    return response
}
