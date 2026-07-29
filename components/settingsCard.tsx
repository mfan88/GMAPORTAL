"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { AppConfig } from "@/lib/appConfig"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type DriveOption = { id: string; name: string }

type SettingsForm = {
  folderName: string
  referenceSheetName: string
  childNameColumn: string
  edcColumn: string
  bufferMinutes: number
  expiryHours: number
  allowedAdminEmailsText: string
}

function configToForm(config: AppConfig): SettingsForm {
  return {
    folderName: config.folderName,
    referenceSheetName: config.referenceSheetName,
    childNameColumn: config.childNameColumn,
    edcColumn: config.edcColumn,
    bufferMinutes: Math.max(0, Math.round(config.bufferTimeMs / 60_000)),
    expiryHours: Math.max(1, Math.round(config.linkExpiryTimeMs / 3_600_000)),
    allowedAdminEmailsText: config.allowedAdminEmails.join("\n"),
  }
}

function formToConfigPatch(form: SettingsForm) {
  const allowedAdminEmails = form.allowedAdminEmailsText
    .split(/[\n,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  return {
    folderName: form.folderName.trim(),
    referenceSheetName: form.referenceSheetName.trim(),
    childNameColumn: form.childNameColumn.trim(),
    edcColumn: form.edcColumn.trim(),
    bufferTimeMs: Math.max(0, form.bufferMinutes) * 60_000,
    linkExpiryTimeMs: Math.max(1, form.expiryHours) * 3_600_000,
    allowedAdminEmails: [...new Set(allowedAdminEmails)],
  }
}

function isBenignFetchInterruption(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return true
  if (!(error instanceof Error)) return false
  return (
    error.name === "AbortError" ||
    error.message === "Failed to fetch" ||
    /aborted|networkerror/i.test(error.message)
  )
}

export default function SettingsCard({
  connected,
  onBanner,
  onConfigSaved,
}: Readonly<{
  connected: boolean
  onBanner: (banner: { type: "success" | "error"; message: string } | null) => void
  onConfigSaved?: () => void
}>) {
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [folders, setFolders] = useState<DriveOption[]>([])
  const [workbooks, setWorkbooks] = useState<DriveOption[]>([])
  const [form, setForm] = useState<SettingsForm | null>(null)
  const [saved, setSaved] = useState<SettingsForm | null>(null)

  const loadBrowse = useCallback(async () => {
    if (!connected) {
      setFolders([])
      setWorkbooks([])
      return
    }

    try {
      const browseRes = await fetch("/api/onedrive/browse")
      const browse = (await browseRes.json()) as {
        folders?: DriveOption[]
        workbooks?: DriveOption[]
        error?: string
      }
      if (!browseRes.ok) {
        throw new Error(browse.error ?? "Could not load OneDrive items")
      }
      setFolders(browse.folders ?? [])
      setWorkbooks(browse.workbooks ?? [])
    } catch (error) {
      // Navigating to Microsoft OAuth aborts in-flight fetches; don't flash a banner.
      if (isBenignFetchInterruption(error)) return
      const message =
        error instanceof Error ? error.message : "Could not load OneDrive items"
      onBanner({ type: "error", message })
    }
  }, [connected, onBanner])

  const load = useCallback(async () => {
    try {
      const configRes = await fetch("/api/config")
      const config = (await configRes.json()) as AppConfig & { error?: string }
      if (!configRes.ok) {
        throw new Error(config.error ?? "Could not load settings")
      }

      const nextForm = configToForm(config)
      setForm(nextForm)
      setSaved(nextForm)
      await loadBrowse()
    } catch (error) {
      if (isBenignFetchInterruption(error)) return
      const message =
        error instanceof Error ? error.message : "Could not load settings"
      onBanner({ type: "error", message })
    } finally {
      setLoading(false)
    }
  }, [loadBrowse, onBanner])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      // Yield so setLoading is not synchronous inside the effect body.
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      await load()
    })()

    return () => {
      cancelled = true
    }
  }, [load])

  const folderItems = useMemo(() => {
    const names = new Set(folders.map((folder) => folder.name))
    const extras =
      form?.folderName && !names.has(form.folderName)
        ? [{ id: `current-${form.folderName}`, name: form.folderName }]
        : []
    return [...extras, ...folders].map((folder) => ({
      label: folder.name,
      value: folder.name,
    }))
  }, [folders, form])

  const workbookItems = useMemo(() => {
    const names = new Set(workbooks.map((file) => file.name))
    const current = form?.referenceSheetName
    const extras =
      current && !names.has(current)
        ? [{ id: `current-${current}`, name: current }]
        : []
    return [...extras, ...workbooks].map((file) => ({
      label: file.name,
      value: file.name,
    }))
  }, [workbooks, form])

  const cancel = () => {
    if (saved) setForm(saved)
    setEditing(false)
  }

  const save = async () => {
    if (!form) return
    if (!form.folderName.trim()) {
      onBanner({ type: "error", message: "Upload folder is required." })
      return
    }
    if (!form.referenceSheetName.trim()) {
      onBanner({ type: "error", message: "Reference workbook is required." })
      return
    }
    if (!form.childNameColumn.trim()) {
      onBanner({ type: "error", message: "Child name column is required." })
      return
    }
    if (!form.edcColumn.trim()) {
      onBanner({ type: "error", message: "EDC column is required." })
      return
    }

    setSaving(true)
    onBanner(null)
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToConfigPatch(form)),
      })
      const data = (await res.json()) as AppConfig & { error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? "Could not save settings")
      }
      const nextForm = configToForm(data)
      setForm(nextForm)
      setSaved(nextForm)
      setEditing(false)
      onBanner({ type: "success", message: "Settings saved." })
      onConfigSaved?.()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save settings"
      onBanner({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex min-h-[22rem] flex-col rounded-xl border border-black/15 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Settings</span>
        {!editing ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!connected || loading || !form}
            onClick={() => {
              setEditing(true)
              void loadBrowse()
            }}
          >
            Change
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={cancel}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {!connected ? (
        <p className="mt-4 text-sm text-black/50">
          Connect a OneDrive account to manage upload settings.
        </p>
      ) : loading || !form ? (
        <p className="mt-4 text-sm text-black/50">Loading settings…</p>
      ) : (
        <div className="mt-4 flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-folder">Upload folder</Label>
            <Select
              items={folderItems}
              value={form.folderName}
              onValueChange={(value) => {
                if (typeof value !== "string") return
                setForm((prev) =>
                  prev ? { ...prev, folderName: value } : prev
                )
              }}
              disabled={!editing}
            >
              <SelectTrigger id="settings-folder" className="w-full">
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {folderItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-black/45">
              Root folders in the connected OneDrive.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-workbook">Reference workbook</Label>
            <Select
              items={workbookItems}
              value={form.referenceSheetName}
              onValueChange={(value) => {
                if (typeof value !== "string") return
                setForm((prev) =>
                  prev ? { ...prev, referenceSheetName: value } : prev
                )
              }}
              disabled={!editing}
            >
              <SelectTrigger id="settings-workbook" className="w-full">
                <SelectValue placeholder="Select an .xlsx file" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {workbookItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-black/45">
              Excel (.xlsx) files found in OneDrive.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-child-column">Child name column</Label>
              <Input
                id="settings-child-column"
                disabled={!editing}
                placeholder="e.g. Child Name or A"
                value={form.childNameColumn}
                onChange={(event) => {
                  const value = event.target.value
                  setForm((prev) =>
                    prev ? { ...prev, childNameColumn: value } : prev
                  )
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-edc-column">EDC column</Label>
              <Input
                id="settings-edc-column"
                disabled={!editing}
                placeholder="e.g. EDC or B"
                value={form.edcColumn}
                onChange={(event) => {
                  const value = event.target.value
                  setForm((prev) =>
                    prev ? { ...prev, edcColumn: value } : prev
                  )
                }}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-black/45">
            Column header text (or letter) used to find the child’s name and EDC
            date in the workbook.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-buffer">Link buffer (minutes)</Label>
              <Input
                id="settings-buffer"
                type="number"
                min={0}
                step={1}
                disabled={!editing}
                value={form.bufferMinutes}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          bufferMinutes: Number.isFinite(value)
                            ? Math.max(0, value)
                            : 0,
                        }
                      : prev
                  )
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-expiry">Link expiry (hours)</Label>
              <Input
                id="settings-expiry"
                type="number"
                min={1}
                step={1}
                disabled={!editing}
                value={form.expiryHours}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          expiryHours: Number.isFinite(value)
                            ? Math.max(1, value)
                            : 1,
                        }
                      : prev
                  )
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-admin-emails">Allowed admin emails</Label>
            <textarea
              id="settings-admin-emails"
              disabled={!editing}
              rows={4}
              placeholder={"name@outlook.com\nname@company.com"}
              value={form.allowedAdminEmailsText}
              onChange={(event) => {
                const value = event.target.value
                setForm((prev) =>
                  prev ? { ...prev, allowedAdminEmailsText: value } : prev
                )
              }}
              className="min-h-24 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-black/45">
              One Microsoft account email per line. These accounts can open
              this admin console. The receiving OneDrive account must also be listed here
              before you connect or change it.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
