"use client"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Check, LinkIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"
import SettingsCard from "@/components/settingsCard"

type ConnectionStatus = {
    connected: boolean
    username: string | null
    tokenStorage?: string
}

type LinkState = "provisioning" | "pending" | "used"

type UploadLink = {
    token: string
    url: string
    createdAt: number
    usedAt: number | null
    state: LinkState
    childName: string | null
    ageWeeks: number | null
}

const STATE_BADGE: Record<LinkState, { label: string; dot: string }> = {
    provisioning: { label: "Provisioning", dot: "bg-amber-500" },
    pending: { label: "Pending Upload", dot: "bg-blue-500" },
    used: { label: "Used", dot: "bg-neutral-400" },
}

function LinkStatusBadge({
    state,
    copied,
}: Readonly<{ state: LinkState; copied: boolean }>) {
    if (copied) {
        return (
            <span className="flex items-center gap-1 text-green-600">
                <Check className="size-3.5" />
                Copied
            </span>
        )
    }

    const { label, dot } = STATE_BADGE[state]
    return (
        <span className="flex items-center gap-1.5">
            <span className={`inline-block size-2 rounded-full ${dot}`} />
            {label}
        </span>
    )
}

type ReferenceChild = {
    name: string
    edc: string | null
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

function weeksOldFromEdc(edc: string | null): number | null {
    if (!edc) return null
    const edcDate = new Date(`${edc}T00:00:00`)
    if (Number.isNaN(edcDate.getTime())) return null
    return Math.floor((Date.now() - edcDate.getTime()) / MS_PER_WEEK)
}

export default function ConsolePage() {
    const [status, setStatus] = useState<ConnectionStatus | null>(null)
    const [links, setLinks] = useState<UploadLink[]>([])
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [copiedToken, setCopiedToken] = useState<string | null>(null)
    const [children, setChildren] = useState<ReferenceChild[]>([])
    const [childNamesLoading, setChildNamesLoading] = useState(false)
    const [childNamesError, setChildNamesError] = useState<string | null>(null)
    const [selectedChild, setSelectedChild] = useState<string | null>(null)
    const [banner, setBanner] = useState<{
        type: "success" | "error"
        message: string
    } | null>(null)

    const loadStatus = useCallback(() => {
        void fetch("/api/auth/onedrive/status")
            .then((res) => res.json())
            .then((data: ConnectionStatus) => setStatus(data))
            .catch(() => setStatus({ connected: false, username: null }))
    }, [])

    const loadLinks = useCallback(() => {
        void fetch("/api/links")
            .then((res) => res.json())
            .then((data: { links?: UploadLink[]; error?: string }) => {
                setLinks(data.links ?? [])
                if (data.error) {
                    setBanner({ type: "error", message: data.error })
                }
            })
            .catch(() => setLinks([]))
    }, [])

    const loadChildNames = useCallback(() => {
        setChildNamesLoading(true)
        setChildNamesError(null)
        void fetch("/api/onedrive/child-names")
            .then(async (res) => {
                const data = (await res.json()) as {
                    children?: ReferenceChild[]
                    names?: string[]
                    error?: string
                }
                if (!res.ok) {
                    throw new Error(
                        data.error ?? "Could not load child names"
                    )
                }
                const nextChildren =
                    data.children ??
                    (data.names ?? []).map((name) => ({ name, edc: null }))
                setChildren(nextChildren)
                setSelectedChild((current) =>
                    current &&
                    nextChildren.some((child) => child.name === current)
                        ? current
                        : null
                )
            })
            .catch((error: unknown) => {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Could not load child names"
                setChildren([])
                setSelectedChild(null)
                setChildNamesError(message)
            })
            .finally(() => setChildNamesLoading(false))
    }, [])

    useEffect(() => {
        loadStatus()
        loadLinks()

        // Poll so link states (Provisioning -> Pending Upload -> Used) stay
        // current without a manual refresh.
        const interval = window.setInterval(loadLinks, 15000)

        const params = new URLSearchParams(window.location.search)
        const connectedParam = params.get("connected") === "1"
        const errorParam = params.get("error")
        let bannerTimeout: number | undefined
        if (connectedParam || errorParam) {
            bannerTimeout = window.setTimeout(() => {
                if (connectedParam) {
                    setBanner({
                        type: "success",
                        message:
                            "OneDrive connected and ready to receive uploads.",
                    })
                } else if (errorParam) {
                    const emailParam = params.get("email")
                    const setupErrors: Record<string, string> = {
                        unauthorized_admin:
                            "That Microsoft account is not on the admin allowlist.",
                        no_admins_configured:
                            "No admin emails are configured. Set ALLOWED_ADMIN_EMAILS in the environment, then connect again.",
                        missing_account:
                            "We could not read the Microsoft account you signed in with.",
                        onedrive_not_allowlisted: emailParam
                            ? `Add ${emailParam} to Allowed admin emails in Settings, then connect that OneDrive account again.`
                            : "That OneDrive account is not on the admin allowlist. Add it in Settings, then try again.",
                    }
                    setBanner({
                        type: "error",
                        message: setupErrors[errorParam] ?? errorParam,
                    })
                }
            }, 0)
        }

        return () => {
            window.clearInterval(interval)
            if (bannerTimeout !== undefined) {
                window.clearTimeout(bannerTimeout)
            }
        }
    }, [loadStatus, loadLinks])

    const portalLinkUrl = useCallback((token: string) => {
        return `${window.location.origin}/portalaccess/${encodeURIComponent(token)}`
    }, [])

    const copyLink = useCallback(
        async (link: UploadLink) => {
            try {
                await navigator.clipboard.writeText(portalLinkUrl(link.token))
                setCopiedToken(link.token)
                window.setTimeout(() => {
                    setCopiedToken((current) =>
                        current === link.token ? null : current
                    )
                }, 2000)
            } catch {
                setBanner({
                    type: "error",
                    message: "Could not copy to clipboard",
                })
            }
        },
        [portalLinkUrl]
    )

    const removeLink = useCallback(
        async (token: string) => {
            setLinks((prev) => prev.filter((link) => link.token !== token))
            try {
                await fetch("/api/links", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                })
            } catch {
                loadLinks()
            }
        },
        [loadLinks]
    )

    const requestRemoveLink = useCallback(
        (link: UploadLink) => {
            if (link.state !== "used") {
                const confirmed = window.confirm(
                    "Are you sure you want to delete this unused link? Anyone with the link will no longer be able to upload."
                )
                if (!confirmed) return
            }
            void removeLink(link.token)
        },
        [removeLink]
    )

    const disconnect = useCallback(() => {
        setIsDisconnecting(true)
        void fetch("/api/auth/onedrive/status", { method: "DELETE" })
            .then(() => {
                setStatus({ connected: false, username: null })
                setBanner(null)
                setChildren([])
                setSelectedChild(null)
                setChildNamesError(null)
            })
            .finally(() => setIsDisconnecting(false))
    }, [])

    const connected = Boolean(status?.connected)

    useEffect(() => {
        if (!connected) return
        const timeout = window.setTimeout(() => {
            loadChildNames()
        }, 0)
        return () => window.clearTimeout(timeout)
    }, [connected, loadChildNames])

    const childItems = children.map((child) => ({
        label: child.name,
        value: child.name,
    }))

    const selectedChildRecord =
        children.find((child) => child.name === selectedChild) ?? null
    const selectedWeeksOld = selectedChildRecord
        ? weeksOldFromEdc(selectedChildRecord.edc)
        : null
    const ageStatement =
        selectedChild && selectedWeeksOld !== null
            ? `According to the provided data, ${selectedChild} is ${Math.max(0, selectedWeeksOld)} weeks old.`
            : null

    const generateLink = useCallback(() => {
        if (!selectedChild || selectedWeeksOld === null) {
            setBanner({
                type: "error",
                message:
                    "Select a child with a valid EDC date before generating a link.",
            })
            return
        }

        setIsGenerating(true)
        setBanner(null)
        void fetch("/api/generate-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                childName: selectedChild,
                ageWeeks: Math.max(0, selectedWeeksOld),
            }),
        })
            .then(async (res) => {
                const data = (await res.json()) as UploadLink & {
                    error?: string
                }
                if (!res.ok) {
                    throw new Error(data.error ?? "Could not generate link")
                }
                loadLinks()
            })
            .catch((error: unknown) => {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Could not generate link"
                setBanner({ type: "error", message })
            })
            .finally(() => setIsGenerating(false))
    }, [loadLinks, selectedChild, selectedWeeksOld])

    const canGenerateLink =
        connected &&
        Boolean(selectedChild) &&
        selectedWeeksOld !== null &&
        !isGenerating

    const childPickerContent = (() => {
        if (!connected) {
            return (
                <p className="text-sm text-black/50">
                    Connect a OneDrive account to load children from the
                    reference workbook.
                </p>
            )
        }
        if (childNamesLoading) {
            return (
                <p className="text-sm text-black/50">
                    Loading children from workbook…
                </p>
            )
        }
        if (childNamesError) {
            return <p className="text-sm text-red-600">{childNamesError}</p>
        }
        if (childItems.length === 0) {
            return (
                <p className="text-sm text-black/50">
                    No names found in the configured child name column. Check
                    Settings.
                </p>
            )
        }
        return (
            <>
                <Select
                    items={childItems}
                    value={selectedChild ?? undefined}
                    onValueChange={(value) => setSelectedChild(value)}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a Child" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {childItems.map((child) => (
                                <SelectItem
                                    key={child.value}
                                    value={child.value}
                                >
                                    {child.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
                {ageStatement && (
                    <p className="text-sm text-black/80">{ageStatement}</p>
                )}
            </>
        )
    })()

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

            <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 pb-16">
                <h1 className="text-center text-3xl font-medium">
                    General Movements Assessment (GMA) Video Portal Console
                </h1>

                {banner && (
                    <Alert
                        variant={
                            banner.type === "error" ? "destructive" : "default"
                        }
                        className="mx-auto max-w-2xl"
                    >
                        <AlertTitle>
                            {banner.type === "error"
                                ? "Something went wrong"
                                : "Success"}
                        </AlertTitle>
                        <AlertDescription>{banner.message}</AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <section className="flex min-h-[22rem] flex-col rounded-xl border border-black/15 p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                                Current Status
                            </span>
                            <span className="flex items-center gap-2 text-sm">
                                <span
                                    className={`inline-block size-2.5 rounded-full ${
                                        connected
                                            ? "bg-green-500"
                                            : "bg-neutral-400"
                                    }`}
                                />
                                {connected ? "Active" : "Inactive"}
                            </span>
                        </div>

                        <p className="mt-3 text-sm text-black/70">
                            {connected
                                ? `Videos upload to: ${status?.username ?? "unknown account"}`
                                : "No receiving OneDrive account is connected yet."}
                        </p>
                        <p className="mt-1 text-xs text-black/45">
                            Changing this prompts a Microsoft sign-in for the
                            receiving account. That email must already be in
                            Allowed admin emails. Console login can still use a
                            different allowlisted account.
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                nativeButton={false}
                                render={<a href="/api/auth/onedrive/login" />}
                            >
                                {connected
                                    ? "Change receiving OneDrive"
                                    : "Connect receiving OneDrive"}
                            </Button>
                            {connected && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isDisconnecting}
                                    onClick={disconnect}
                                >
                                    {isDisconnecting
                                        ? "Disconnecting..."
                                        : "Disconnect"}
                                </Button>
                            )}
                        </div>

                        <Separator className="my-4" />

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                                Active Links{" "}
                                <span className="text-black/50">
                                    (Click to Copy to Clipboard)
                                </span>
                            </span>
                        </div>

                        <div className="mt-3 flex-1 overflow-y-auto pr-1">
                            {links.length === 0 ? (
                                <p className="text-sm text-black/40">
                                    No active links yet. Generate one to share
                                    with a parent.
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-2">
                                    {links.map((link) => {
                                        const isCopied =
                                            copiedToken === link.token
                                        const isUsed = link.state === "used"
                                        const body = (
                                            <>
                                                <span className="flex items-center justify-between text-xs text-black/50">
                                                    <span>
                                                        {format(
                                                            new Date(
                                                                link.createdAt
                                                            ),
                                                            "MMM d, yyyy 'at' h:mm a"
                                                        )}
                                                    </span>
                                                    <LinkStatusBadge
                                                        state={link.state}
                                                        copied={isCopied}
                                                    />
                                                </span>
                                                <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-black/80">
                                                    <LinkIcon className="size-3.5 shrink-0" />
                                                    <span className="min-w-0 truncate">
                                                        {portalLinkUrl(
                                                            link.token
                                                        )}
                                                    </span>
                                                </span>
                                                {link.childName && (
                                                    <span className="text-xs text-black/55">
                                                        {link.childName}
                                                        {typeof link.ageWeeks ===
                                                        "number"
                                                            ? ` · ${link.ageWeeks}w`
                                                            : ""}
                                                    </span>
                                                )}
                                            </>
                                        )
                                        return (
                                            <li
                                                key={link.token}
                                                className="flex items-stretch gap-2"
                                            >
                                                {isUsed ? (
                                                    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-left opacity-70">
                                                        {body}
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void copyLink(link)
                                                        }
                                                        className="group flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-left transition-colors hover:bg-black/[0.05]"
                                                    >
                                                        {body}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        requestRemoveLink(link)
                                                    }
                                                    aria-label="Delete link"
                                                    title={
                                                        isUsed
                                                            ? "Remove from list"
                                                            : "Delete unused link"
                                                    }
                                                    className="flex shrink-0 items-center justify-center rounded-lg border border-black/10 px-2 text-black/40 transition-colors hover:bg-black/[0.05] hover:text-black/80"
                                                >
                                                    <X className="size-4" />
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </div>
                    </section>

                    <section className="flex min-h-[22rem] flex-col rounded-xl border border-black/15 p-6 shadow-sm">
                        <div className="flex flex-1 flex-col gap-3">
                            <span className="text-sm font-medium">
                                Create New Link
                            </span>
                            {childPickerContent}
                        </div>
                        <Button
                            className="mt-4 py-10"
                            size="sm"
                            disabled={!canGenerateLink}
                            onClick={generateLink}
                        >
                            {isGenerating
                                ? "Generating..."
                                : "Generate new link"}
                        </Button>
                    </section>

                    <SettingsCard
                        connected={connected}
                        onBanner={setBanner}
                        onConfigSaved={loadChildNames}
                    />
                </div>

                <Link href="/" className="mx-auto text-sm underline">
                    Back to upload portal
                </Link>
            </main>
        </div>
    )
}
