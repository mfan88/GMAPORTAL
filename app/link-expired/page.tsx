import Image from "next/image"
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"
import LinkPendingCountdown from "@/components/linkPendingCountdown"
import { getAppConfig, linkExpirySeconds } from "@/lib/server"

export const dynamic = "force-dynamic"

function firstParam(
    value: string | string[] | undefined
): string | undefined {
    if (Array.isArray(value)) return value[0]
    return value
}

export default async function LinkExpiredPage({
    searchParams,
}: Readonly<{
    searchParams: Promise<{
        reason?: string | string[]
        availableAt?: string | string[]
        token?: string | string[]
    }>
}>) {
    const params = await searchParams
    const reason = firstParam(params.reason)
    const isPending = reason === "pending"
    const token = firstParam(params.token)
    const availableAtRaw = Number(firstParam(params.availableAt))
    const availableAt =
        Number.isFinite(availableAtRaw) && availableAtRaw > 0
            ? availableAtRaw
            : null

    const config = await getAppConfig()
    const expiryHours = Math.max(
        1,
        Math.round(linkExpirySeconds(config) / 3600)
    )

    let mainContent
    if (isPending && availableAt) {
        mainContent = (
            <LinkPendingCountdown availableAt={availableAt} token={token} />
        )
    } else if (isPending) {
        mainContent = (
            <div className="flex max-w-xl flex-col items-center gap-3 text-center">
                <p className="text-base text-black sm:text-lg">
                    This upload link will be available in:
                </p>
                <p className="text-2xl font-bold text-black sm:text-3xl">
                    a short while
                </p>
                <p className="text-base text-black sm:text-lg">
                    Please wait until then to upload your video. Thank you.
                </p>
            </div>
        )
    } else {
        mainContent = (
            <Alert className="mx-auto max-w-lg">
                <AlertTitle>
                    This upload link has expired or was already used
                </AlertTitle>
                <AlertDescription>
                    Ask your clinic for a new parent upload link. Each link
                    works once and is valid for {expiryHours} hours.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-white text-black">
            <header className="box-border h-24 shrink-0 p-4">
                <Image
                    className="h-full w-auto"
                    src="/images/dda-logo.svg"
                    alt="Developmental Disabilities Association"
                    width={1338}
                    height={472}
                    priority
                />
            </header>

            <main className="flex flex-1 items-center justify-center px-6 pb-24">
                {mainContent}
            </main>
        </div>
    )
}
