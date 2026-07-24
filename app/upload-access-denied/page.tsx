"use client"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"

const errorMessages: Record<string, string> = {
    not_configured: "No receiving OneDrive account is connected yet.",
    missing_account: "We could not read the account you signed in with.",
    missing_code: "The sign-in did not complete. Please try again.",
    missing_pkce_verifier:
        "The sign-in session expired. Please start the link again.",
    wrong_account:
        "You signed in with a different account than the receiving OneDrive account.",
    unauthorized_admin:
        "This Microsoft account is not authorized to access the admin console. Ask an existing admin to add your email to the allowlist.",
    no_admins_configured:
        "No admin emails are configured yet. Set ALLOWED_ADMIN_EMAILS in the environment or add emails in Settings.",
}

export default function UploadAccessDeniedPage() {
    const [detail, setDetail] = useState<string | null>(null)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const error = params.get("error")
        if (!error) return

        if (error === "wrong_account") {
            const signedIn = params.get("signedIn")
            const expected = params.get("expected")
            setDetail(
                `${errorMessages.wrong_account} You used ${signedIn ?? "unknown"}, but the receiving account is ${expected ?? "unknown"}.`
            )
            return
        }

        setDetail(errorMessages[error] ?? error)
    }, [])

    return (
        <div className="min-h-screen w-full bg-white text-black">
            <header className="box-border h-24 p-4">
                <Image
                    className="h-full w-auto"
                    src="/images/dda-logo.svg"
                    alt="DDA logo"
                    width={1338}
                    height={472}
                />
            </header>
            <main className="mx-auto mt-8 flex max-w-lg flex-col items-center gap-6 px-4">
                <h1 className="text-3xl font-medium">Access denied</h1>
                <Alert variant="destructive" className="w-full">
                    <AlertTitle>You do not have upload access</AlertTitle>
                    <AlertDescription>
                        {detail ??
                            "Use a valid parent upload link or sign in with the receiving OneDrive account."}
                    </AlertDescription>
                </Alert>
                <Link href="/setup" className="text-sm underline">
                    Clinic admin? Go to the console
                </Link>
            </main>
        </div>
    )
}
