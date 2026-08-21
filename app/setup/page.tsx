"use client"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import SettingsCard from "@/components/settingsCard"
import DatePicker from "@/components/datePicker"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { AppConfig } from "@/lib/appConfig"

type ConnectionStatus = {
  connected: boolean
  username: string | null
  siteId?: string | null
  siteUrl?: string | null
  siteName?: string | null
  writeAccess?: boolean
  error?: string
  tokenStorage?: string
}

type LinkState = "scheduled" | "provisioning" | "pending" | "used"

type UploadLink = {
  token: string
  url: string
  createdAt: number
  usedAt: number | null
  state: LinkState
  childName: string | null
  edc: string | null
  scheduledDate: string | null
}

const STATE_BADGE: Record<LinkState, { label: string; dot: string }> = {
  scheduled: { label: "Scheduled", dot: "bg-teal-600" },
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

export default function ConsolePage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [links, setLinks] = useState<UploadLink[]>([])
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isConnectingSite, setIsConnectingSite] = useState(false)
  const [siteUrlInput, setSiteUrlInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [children, setChildren] = useState<ReferenceChild[]>([])
  const [childNamesLoading, setChildNamesLoading] = useState(false)
  const [childNamesError, setChildNamesError] = useState<string | null>(null)
  const [selectedChild, setSelectedChild] = useState<string | null>(null)
  const [selectedEdc, setSelectedEdc] = useState<string | null>(null)
  const [isSchedulingLetter, setIsSchedulingLetter] = useState(false)
  const [letterScheduleDate, setLetterScheduleDate] = useState<
    Date | undefined
  >(undefined)
  const [banner, setBanner] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [allowedAdminEmails, setAllowedAdminEmails] = useState<string[]>([])
  const [uploadNotificationEmail, setUploadNotificationEmail] = useState("")
  const [notificationSaving, setNotificationSaving] = useState(false)

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

  const loadConfig = useCallback(() => {
    void fetch("/api/config")
      .then(async (res) => {
        const data = (await res.json()) as AppConfig & { error?: string }
        if (!res.ok) {
          throw new Error(data.error ?? "Could not load settings")
        }
        setAllowedAdminEmails(data.allowedAdminEmails ?? [])
        setUploadNotificationEmail(data.uploadNotificationEmail ?? "")
      })
      .catch(() => {
        setAllowedAdminEmails([])
        setUploadNotificationEmail("")
      })
  }, [])

  const saveNotificationEmail = useCallback(
    async (email: string) => {
      const previous = uploadNotificationEmail
      setUploadNotificationEmail(email)
      setNotificationSaving(true)
      setBanner(null)
      try {
        const res = await fetch("/api/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadNotificationEmail: email }),
        })
        const data = (await res.json()) as AppConfig & { error?: string }
        if (!res.ok) {
          throw new Error(data.error ?? "Could not save notification email")
        }
        setAllowedAdminEmails(data.allowedAdminEmails ?? [])
        setUploadNotificationEmail(data.uploadNotificationEmail ?? "")
      } catch (error) {
        setUploadNotificationEmail(previous)
        setBanner({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not save notification email",
        })
      } finally {
        setNotificationSaving(false)
      }
    },
    [uploadNotificationEmail]
  )

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
          throw new Error(data.error ?? "Could not load child names")
        }
        const nextChildren =
          data.children ??
          (data.names ?? []).map((name) => ({ name, edc: null }))
        setChildren(nextChildren)
        setSelectedChild((current) =>
          current && nextChildren.some((child) => child.name === current)
            ? current
            : null
        )
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Could not load child names"
        setChildren([])
        setSelectedChild(null)
        setChildNamesError(message)
      })
      .finally(() => setChildNamesLoading(false))
  }, [])

  useEffect(() => {
    loadStatus()
    loadLinks()
    loadConfig()

    // Poll so link states (Provisioning -> Pending Upload -> Used) stay
    // current without a manual refresh.
    const interval = window.setInterval(loadLinks, 15000)

    const params = new URLSearchParams(window.location.search)
    const connectedParam = params.get("connected") === "1"
    const grantedParam = params.get("granted") === "1"
    const errorParam = params.get("error")
    let bannerTimeout: number | undefined
    if (connectedParam || grantedParam || errorParam) {
      bannerTimeout = window.setTimeout(() => {
        if (grantedParam) {
          setBanner({
            type: "success",
            message:
              "App write access granted on the SharePoint site. Uploads should work now.",
          })
          loadStatus()
        } else if (connectedParam) {
          setBanner({
            type: "success",
            message: "SharePoint site connected and ready to receive uploads.",
          })
        } else if (errorParam) {
          const setupErrors: Record<string, string> = {
            unauthorized_admin:
              "That Microsoft account is not on the admin allowlist.",
            no_admins_configured:
              "No admin emails are configured. Set ALLOWED_ADMIN_EMAILS in the environment, then sign in again.",
            missing_account:
              "We could not read the Microsoft account you signed in with.",
            use_sharepoint_connect:
              "Connect a SharePoint site from this page instead of signing in a personal OneDrive account.",
            site_not_connected:
              "Connect a SharePoint site first, then grant write access.",
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
  }, [loadStatus, loadLinks, loadConfig])

  const portalLinkUrl = useCallback((token: string) => {
    return `${window.location.origin}/portalaccess/${encodeURIComponent(token)}`
  }, [])

  const copyLink = useCallback(
    async (link: UploadLink) => {
      try {
        await navigator.clipboard.writeText(portalLinkUrl(link.token))
        setCopiedToken(link.token)
        window.setTimeout(() => {
          setCopiedToken((current) => (current === link.token ? null : current))
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
        setSiteUrlInput("")
        setBanner(null)
        setChildren([])
        setSelectedChild(null)
        setSelectedEdc(null)
        setIsSchedulingLetter(false)
        setLetterScheduleDate(undefined)
        setChildNamesError(null)
      })
      .finally(() => setIsDisconnecting(false))
  }, [])

  const connectSite = useCallback(async () => {
    const siteUrl = siteUrlInput.trim()
    if (!siteUrl) {
      setBanner({
        type: "error",
        message: "Enter a SharePoint site URL (or Graph site id) first.",
      })
      return
    }

    setIsConnectingSite(true)
    setBanner(null)
    try {
      const res = await fetch("/api/sharepoint/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl }),
      })
      const data = (await res.json()) as ConnectionStatus & { error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? "Could not connect SharePoint site")
      }
      setStatus({
        connected: true,
        username: data.siteName ?? data.username ?? null,
        siteId: data.siteId,
        siteUrl: data.siteUrl,
        siteName: data.siteName,
      })
      setBanner({
        type: "success",
        message: "SharePoint site connected. Next: grant write access if prompted.",
      })
      loadStatus()
      loadChildNames()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not connect SharePoint site"
      setBanner({ type: "error", message })
    } finally {
      setIsConnectingSite(false)
    }
  }, [loadChildNames, siteUrlInput])

  const connected = Boolean(status?.connected)

  const notificationEmailItems = useMemo(() => {
    const emails = new Set(allowedAdminEmails)
    const extras =
      uploadNotificationEmail && !emails.has(uploadNotificationEmail)
        ? [uploadNotificationEmail]
        : []
    return [...extras, ...allowedAdminEmails].map((email) => ({
      label: email,
      value: email,
    }))
  }, [allowedAdminEmails, uploadNotificationEmail])

  useEffect(() => {
    if (!connected) return
    const timeout = window.setTimeout(() => {
      loadChildNames()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [connected, loadChildNames])

  const workbookEdc =
    children.find((child) => child.name === selectedChild)?.edc ?? null

  let edcStatement: string | null = null
  if (selectedChild && workbookEdc) {
    edcStatement = `EDC on file for ${selectedChild}: ${workbookEdc}. Age in weeks will be calculated from this EDC to the date the parent records on upload.`
  } else if (selectedChild) {
    edcStatement = `No EDC on file for ${selectedChild}. Enter one below to generate a link.`
  }

  const childItems = children.map((child) => ({
    label: child.name,
    value: child.name,
  }))

  const generateLink = useCallback(() => {
    if (!selectedChild || !selectedEdc) {
      setBanner({
        type: "error",
        message:
          "Select a child with a valid EDC date before generating a link.",
      })
      return
    }

    if (isSchedulingLetter && !letterScheduleDate) {
      setBanner({
        type: "error",
        message: "Pick the letter schedule date before generating a link.",
      })
      return
    }

    const scheduledDate = isSchedulingLetter
      ? format(letterScheduleDate!, "yyyy-MM-dd")
      : null

    setIsGenerating(true)
    setBanner(null)
    void fetch("/api/generate-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childName: selectedChild,
        edc: selectedEdc,
        scheduledDate,
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
          error instanceof Error ? error.message : "Could not generate link"
        setBanner({ type: "error", message })
      })
      .finally(() => setIsGenerating(false))
  }, [
    isSchedulingLetter,
    letterScheduleDate,
    loadLinks,
    selectedChild,
    selectedEdc,
  ])

  const canGenerateLink =
    connected &&
    Boolean(selectedChild) &&
    Boolean(selectedEdc) &&
    (!isSchedulingLetter || Boolean(letterScheduleDate)) &&
    !isGenerating

  const childPickerContent = (() => {
    if (!connected) {
      return (
        <p className="text-sm text-black/50">
          Connect a SharePoint site to load children from the reference
          workbook.
        </p>
      )
    }
    if (childNamesLoading) {
      return (
        <p className="text-sm text-black/50">Loading children from workbook…</p>
      )
    }
    if (childNamesError) {
      return <p className="text-sm text-red-600">{childNamesError}</p>
    }
    if (childItems.length === 0) {
      return (
        <p className="text-sm text-black/50">
          No names found in the configured child name column. Check Settings.
        </p>
      )
    }
    return (
      <>
        <Select
          items={childItems}
          value={selectedChild ?? undefined}
          onValueChange={(value) => {
            const nextEdc =
              children.find((child) => child.name === value)?.edc ?? null
            setSelectedChild(value)
            setSelectedEdc(nextEdc)
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a Child" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {childItems.map((child) => (
                <SelectItem key={child.value} value={child.value}>
                  {child.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {edcStatement ? (
          <p className="text-sm text-black/80">{edcStatement}</p>
        ) : null}

        {selectedChild && !workbookEdc ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edc-entry">EDC date</Label>
            <Input
              id="edc-entry"
              type="date"
              value={selectedEdc ?? ""}
              onChange={(event) => {
                setSelectedEdc(event.target.value || null)
              }}
            />
            <p className="text-xs text-black/50">
              Stored on the link and used to calculate age at upload.
            </p>
          </div>
        ) : null}

        {selectedChild ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="schedule-letter"
                checked={isSchedulingLetter}
                onCheckedChange={(checked) => {
                  const scheduling = checked === true
                  setIsSchedulingLetter(scheduling)
                  if (!scheduling) {
                    setLetterScheduleDate(undefined)
                  }
                }}
              />
              <Label htmlFor="schedule-letter">
                Are you scheduling the letter?
              </Label>
            </div>
            {isSchedulingLetter ? (
              <div className="flex flex-col gap-1.5">
                <Label>Letter date</Label>
                <DatePicker
                  className="w-full"
                  date={letterScheduleDate}
                  setDate={setLetterScheduleDate}
                />
                <p className="text-xs text-black/50">
                  The portal link stays unavailable until this date. On that
                  day the activation buffer begins.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </>
    )
  })()

  return (
    <div className="min-h-screen w-full bg-white text-black">
      <header className="box-border flex h-24 items-center justify-between gap-4 p-4">
        <Image
          className="h-full w-auto"
          src="/images/dda-logo.svg"
          alt="DDA logo"
          width={1338}
          height={472}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            window.location.assign("/api/auth/admin/logout")
          }}
        >
          Sign out
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 pb-16">
        <h1 className="text-center text-3xl font-medium">
          General Movements Assessment (GMA) Video Portal Console
        </h1>

        {banner && (
          <Alert
            variant={banner.type === "error" ? "destructive" : "default"}
            className="mx-auto max-w-2xl"
          >
            <AlertTitle>
              {banner.type === "error" ? "Something went wrong" : "Success"}
            </AlertTitle>
            <AlertDescription>{banner.message}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="flex min-h-[22rem] flex-col rounded-xl border border-black/15 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Status</span>
              <span className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-block size-2.5 rounded-full ${
                    connected ? "bg-green-500" : "bg-neutral-400"
                  }`}
                />
                {connected ? "Active" : "Inactive"}
              </span>
            </div>

            <p className="mt-3 text-sm text-black/70">
              {connected
                ? `Videos upload to: ${status?.siteName ?? status?.username ?? "SharePoint site"}`
                : "No SharePoint site is connected yet."}
            </p>
            {connected && status?.siteUrl ? (
              <p className="mt-1 truncate text-xs text-black/45">
                {status.siteUrl}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-black/45">
              Connect your org SharePoint site, then use{" "}
              <span className="font-medium">Grant write access</span> so this
              app can upload (Sites.Selected). That step signs you in once as a
              SharePoint admin; the elevated token is not stored.
            </p>

            {!connected && (
              <div className="mt-3 space-y-2">
                <Label htmlFor="sharepoint-site-url" className="text-xs">
                  SharePoint site URL
                </Label>
                <Input
                  id="sharepoint-site-url"
                  value={siteUrlInput}
                  onChange={(event) => setSiteUrlInput(event.target.value)}
                  placeholder="https://contoso.sharepoint.com/sites/Uploads"
                />
              </div>
            )}

            {connected && status?.writeAccess !== true ? (
              <p className="mt-2 text-xs text-amber-700">
                Site is connected, but the app cannot write yet. Click Grant
                write access (requires Entra delegated Sites.FullControl.All +
                a SharePoint/Global admin).
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {!connected ? (
                <Button
                  size="sm"
                  disabled={isConnectingSite}
                  onClick={() => {
                    void connectSite()
                  }}
                >
                  {isConnectingSite ? "Connecting..." : "Connect SharePoint site"}
                </Button>
              ) : (
                <>
                  {status?.writeAccess !== true ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        window.location.assign(
                          "/api/auth/sharepoint/grant-access"
                        )
                      }}
                    >
                      Grant write access
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDisconnecting}
                    onClick={disconnect}
                  >
                    {isDisconnecting ? "Disconnecting..." : "Disconnect site"}
                  </Button>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <Label htmlFor="notification-email">
                Upload notification email
              </Label>
              <Select
                items={notificationEmailItems}
                value={uploadNotificationEmail || null}
                onValueChange={(value) => {
                  if (typeof value !== "string") return
                  if (value === uploadNotificationEmail) return
                  void saveNotificationEmail(value)
                }}
                disabled={
                  notificationSaving || notificationEmailItems.length === 0
                }
              >
                <SelectTrigger id="notification-email" className="w-full">
                  <SelectValue placeholder="Select an allowlisted email" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {notificationEmailItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs text-black/45">
                {notificationEmailItems.length === 0
                  ? "Add allowed admin emails in Settings first."
                  : "This address receives a message when a parent upload succeeds."}
              </p>
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
                  No active links yet. Generate one to share with a parent.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {links.map((link) => {
                    const isCopied = copiedToken === link.token
                    const isUsed = link.state === "used"
                    const body = (
                      <>
                        <span className="flex items-center justify-between text-xs text-black/50">
                          <span>
                            {format(
                              new Date(link.createdAt),
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
                            {portalLinkUrl(link.token)}
                          </span>
                        </span>
                        {link.childName && (
                          <span className="text-xs text-black/55">
                            {link.childName}
                            {link.edc ? ` · EDC ${link.edc}` : ""}
                            {link.scheduledDate
                              ? ` · Letter ${link.scheduledDate}`
                              : ""}
                          </span>
                        )}
                      </>
                    )
                    return (
                      <li key={link.token} className="flex items-stretch gap-2">
                        {isUsed ? (
                          <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-left opacity-70">
                            {body}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void copyLink(link)}
                            className="group flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-left transition-colors hover:bg-black/[0.05]"
                          >
                            {body}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => requestRemoveLink(link)}
                          aria-label="Delete link"
                          title={
                            isUsed ? "Remove from list" : "Delete unused link"
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
              <span className="text-sm font-medium">Create New Link</span>
              {childPickerContent}
            </div>
            <Button
              className="mt-4 py-10"
              size="sm"
              disabled={!canGenerateLink}
              onClick={generateLink}
            >
              {isGenerating ? "Generating..." : "Generate new link"}
            </Button>
          </section>

          <SettingsCard
            connected={connected}
            onBanner={setBanner}
            onConfigSaved={() => {
              loadChildNames()
              loadConfig()
            }}
          />
        </div>

        <Link href="/" className="mx-auto text-sm underline">
          Back to upload portal
        </Link>
      </main>
    </div>
  )
}
