"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import type {
  AppConfig,
  WorkbookColumn,
  WorkbookColumnKind,
} from "@/lib/appConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function notify(banner: { type: "success" | "error"; message: string } | null) {
  if (!banner) return;
  if (banner.type === "error") toast.error(banner.message);
  else toast.success(banner.message);
}

type DriveOption = { id: string; name: string };

type DurationUnit = "seconds" | "minutes" | "hours" | "days";

const DURATION_UNITS: { value: DurationUnit; label: string }[] = [
  { value: "seconds", label: "s" },
  { value: "minutes", label: "min" },
  { value: "hours", label: "hrs" },
  { value: "days", label: "days" },
];

const UNIT_MS: Record<DurationUnit, number> = {
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

type SettingsForm = {
  folderName: string;
  referenceSheetName: string;
  referenceWorksheetName: string;
  childNameColumn: string;
  edcColumn: string;
  /** Digits-only text; empty string means unset / invalid for save. */
  bufferValue: string;
  bufferUnit: DurationUnit;
  /** Digits-only text; empty string means unset / invalid for save. */
  expiryValue: string;
  expiryUnit: DurationUnit;
  allowedAdminEmails: string[];
};

function msToDuration(
  ms: number,
  options: { allowZero: boolean }
): { value: string; unit: DurationUnit } {
  const raw = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;
  if (raw === 0 && options.allowZero) {
    return { value: "0", unit: "minutes" };
  }

  const positive = Math.max(options.allowZero ? 0 : 1, raw);
  if (positive % UNIT_MS.days === 0) {
    return { value: String(positive / UNIT_MS.days), unit: "days" };
  }
  if (positive % UNIT_MS.hours === 0) {
    return { value: String(positive / UNIT_MS.hours), unit: "hours" };
  }
  if (positive % UNIT_MS.minutes === 0) {
    return { value: String(positive / UNIT_MS.minutes), unit: "minutes" };
  }
  return {
    value: String(Math.max(1, Math.round(positive / UNIT_MS.seconds))),
    unit: "seconds",
  };
}

function parseDurationInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function durationToMs(value: string, unit: DurationUnit) {
  const amount = parseDurationInput(value);
  if (amount === null) return 0;
  return Math.max(0, amount) * UNIT_MS[unit];
}

function digitsOnlyInput(raw: string) {
  return raw.replace(/\D/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const NAME_COLUMN_KINDS: WorkbookColumnKind[] = ["text", "unknown"];
const EDC_COLUMN_KINDS: WorkbookColumnKind[] = ["date", "text", "unknown"];

function columnsToSelectItems(
  columns: WorkbookColumn[],
  kinds: WorkbookColumnKind[],
  current: string
) {
  const allowed = new Set(kinds);
  const items = columns
    .filter((column) => allowed.has(column.kind))
    .map((column) => ({
      label: column.name,
      value: column.name,
    }));

  if (current && !items.some((item) => item.value === current)) {
    return [{ label: current, value: current }, ...items];
  }
  return items;
}

function resolveColumnSelection(columns: WorkbookColumn[], spec: string) {
  const trimmed = spec.trim();
  if (!trimmed) return "";

  const byName = columns.find(
    (column) => column.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (byName) return byName.name;

  const byLetter = columns.find(
    (column) => column.letter.toUpperCase() === trimmed.toUpperCase()
  );
  if (byLetter) return byLetter.name;

  return "";
}

function configToForm(config: AppConfig): SettingsForm {
  const buffer = msToDuration(config.bufferTimeMs, { allowZero: true });
  const expiry = msToDuration(config.linkExpiryTimeMs, { allowZero: false });
  return {
    folderName: config.folderName,
    referenceSheetName: config.referenceSheetName,
    referenceWorksheetName: config.referenceWorksheetName,
    childNameColumn: config.childNameColumn,
    edcColumn: config.edcColumn,
    bufferValue: buffer.value,
    bufferUnit: buffer.unit,
    expiryValue: expiry.value,
    expiryUnit: expiry.unit,
    allowedAdminEmails: [...config.allowedAdminEmails.map(normalizeEmail)],
  };
}

function formToConfigPatch(form: SettingsForm) {
  const bufferAmount = parseDurationInput(form.bufferValue);
  const expiryAmount = parseDurationInput(form.expiryValue);
  if (bufferAmount === null || expiryAmount === null) {
    throw new Error("Buffer and link availability require a number.");
  }

  return {
    folderName: form.folderName.trim(),
    referenceSheetName: form.referenceSheetName.trim(),
    referenceWorksheetName: form.referenceWorksheetName.trim(),
    childNameColumn: form.childNameColumn.trim(),
    edcColumn: form.edcColumn.trim(),
    bufferTimeMs: durationToMs(form.bufferValue, form.bufferUnit),
    linkExpiryTimeMs: Math.max(
      UNIT_MS.seconds,
      durationToMs(form.expiryValue, form.expiryUnit)
    ),
    allowedAdminEmails: [
      ...new Set(form.allowedAdminEmails.map(normalizeEmail)),
    ],
  };
}

function isBenignFetchInterruption(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AbortError" ||
    error.message === "Failed to fetch" ||
    /aborted|networkerror/i.test(error.message)
  );
}

function DurationField({
  id,
  label,
  value,
  unit,
  disabled,
  onValueChange,
  onUnitChange,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  unit: DurationUnit;
  disabled: boolean;
  onValueChange: (value: string) => void;
  onUnitChange: (unit: DurationUnit) => void;
}>) {
  const unitItems = DURATION_UNITS.map((item) => ({
    label: item.label,
    value: item.value,
  }));

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={disabled}
          value={value}
          onChange={(event) => {
            onValueChange(digitsOnlyInput(event.target.value));
          }}
          className="min-w-0 flex-1"
        />
        <Select
          items={unitItems}
          value={unit}
          onValueChange={(next) => {
            if (typeof next !== "string") return;
            onUnitChange(next as DurationUnit);
          }}
          disabled={disabled}
        >
          <SelectTrigger
            className="w-[5.5rem] shrink-0"
            aria-label={`${label} unit`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {DURATION_UNITS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function AdminEmailsCard({
  mode,
  emails,
  newEmail,
  pendingRemoveEmail,
  onNewEmailChange,
  onAdd,
  onRemove,
  onCancelPendingRemove,
  onClose,
}: Readonly<{
  mode: "view" | "manage";
  emails: string[];
  newEmail: string;
  pendingRemoveEmail: string | null;
  onNewEmailChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (email: string) => void;
  onCancelPendingRemove: () => void;
  onClose: () => void;
}>) {
  const managing = mode === "manage";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-emails-card-title"
        className="flex max-h-[min(36rem,calc(100vh-2rem))] w-full max-w-md flex-col rounded-sm border border-[#02182B]/15 bg-white p-5 text-[#02182B] shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="admin-emails-card-title" className="text-sm font-medium">
            {managing ? "Add and remove emails" : "Allowed admin emails"}
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2"
            onClick={onClose}
          >
            <X className="size-3.5" />
            Close
          </Button>
        </div>

        <ul className="mt-4 divide-y divide-[#02182B]/10 overflow-y-auto rounded-sm border border-[#02182B]/10">
          {emails.length === 0 ? (
            <li className="px-3 py-3 text-sm text-[#02182B]/45">
              No admin emails yet.
            </li>
          ) : (
            emails.map((email) => {
              const confirming = pendingRemoveEmail === email;
              return (
                <li key={email} className="flex items-center gap-2 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {email}
                  </span>
                  {managing ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={confirming ? "destructive" : "outline"}
                      className="h-8 shrink-0 gap-1 px-2"
                      onClick={() => onRemove(email)}
                      onBlur={() => {
                        if (pendingRemoveEmail === email) {
                          onCancelPendingRemove();
                        }
                      }}
                    >
                      {confirming ? (
                        <>
                          <Check className="size-3.5" />
                          Confirm
                        </>
                      ) : (
                        <Minus className="size-3.5" />
                      )}
                    </Button>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>

        {managing ? (
          <div className="mt-3 flex flex-col gap-2">
            <Label htmlFor="settings-new-admin-email" className="text-xs">
              New admin email
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="settings-new-admin-email"
                type="email"
                autoFocus
                placeholder="name@company.com"
                value={newEmail}
                onChange={(event) => onNewEmailChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onAdd();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onClose();
                  }
                }}
              />
              <Button type="button" size="sm" className="gap-1" onClick={onAdd}>
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
            <p className="text-xs text-[#02182B]/45">
              Click − once, then Confirm to remove. Changes apply when you Save
              settings.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function SettingsCard({
  connected,
  onConfigSaved,
}: Readonly<{
  connected: boolean;
  onConfigSaved?: () => void;
}>) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [folders, setFolders] = useState<DriveOption[]>([]);
  const [workbooks, setWorkbooks] = useState<DriveOption[]>([]);
  const [columns, setColumns] = useState<WorkbookColumn[]>([]);
  const [worksheets, setWorksheets] = useState<string[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnsError, setColumnsError] = useState<string | null>(null);
  const columnsSourceRef = useRef<{ workbook: string; sheet: string } | null>(
    null
  );
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saved, setSaved] = useState<SettingsForm | null>(null);
  const [emailPanel, setEmailPanel] = useState<"view" | "manage" | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [pendingRemoveEmail, setPendingRemoveEmail] = useState<string | null>(
    null
  );

  const loadBrowse = useCallback(async () => {
    if (!connected) {
      setFolders([]);
      setWorkbooks([]);
      return;
    }

    setBrowseLoading(true);
    try {
      const browseRes = await fetch("/api/onedrive/browse");
      const browse = (await browseRes.json()) as {
        folders?: DriveOption[];
        workbooks?: DriveOption[];
        error?: string;
      };
      if (!browseRes.ok) {
        throw new Error(browse.error ?? "Could not load SharePoint items");
      }
      setFolders(browse.folders ?? []);
      setWorkbooks(browse.workbooks ?? []);
    } catch (error) {
      if (isBenignFetchInterruption(error)) return;
      const message =
        error instanceof Error
          ? error.message
          : "Could not load SharePoint items";
      notify({ type: "error", message });
    } finally {
      setBrowseLoading(false);
    }
  }, [connected, notify]);

  const load = useCallback(async () => {
    try {
      const configRes = await fetch("/api/config");
      const config = (await configRes.json()) as AppConfig & { error?: string };
      if (!configRes.ok) {
        throw new Error(config.error ?? "Could not load settings");
      }

      const nextForm = configToForm(config);
      setForm(nextForm);
      setSaved(nextForm);
    } catch (error) {
      if (isBenignFetchInterruption(error)) return;
      const message =
        error instanceof Error ? error.message : "Could not load settings";
      notify({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      await load();
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const workbookName = form?.referenceSheetName.trim() ?? "";
  const worksheetName = form?.referenceWorksheetName.trim() ?? "";

  useEffect(() => {
    if (!connected || !editing || !workbookName) {
      if (!editing) {
        columnsSourceRef.current = null;
        setWorksheets([]);
        setColumns([]);
        setColumnsError(null);
        setColumnsLoading(false);
      }
      return;
    }

    const loaded = columnsSourceRef.current;
    if (
      loaded &&
      loaded.workbook === workbookName &&
      (worksheetName === loaded.sheet || (!worksheetName && loaded.sheet))
    ) {
      setColumnsLoading(false);
      return;
    }

    const controller = new AbortController();
    const staleColumns =
      loaded?.workbook !== workbookName ||
      (Boolean(worksheetName) && loaded?.sheet !== worksheetName);
    if (staleColumns) {
      setColumns([]);
    }
    setColumnsLoading(true);
    setColumnsError(null);

    void (async () => {
      try {
        const params = new URLSearchParams({ name: workbookName });
        if (worksheetName) params.set("sheet", worksheetName);
        const res = await fetch(`/api/onedrive/workbook-columns?${params}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as {
          columns?: WorkbookColumn[];
          sheets?: string[];
          sheetName?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not load workbook columns");
        }
        const nextSheets = data.sheets ?? [];
        const resolvedSheet = data.sheetName ?? nextSheets[0] ?? "";
        const nextColumns = data.columns ?? [];
        const workbookChanged =
          columnsSourceRef.current != null &&
          columnsSourceRef.current.workbook !== workbookName;
        const sheetChanged =
          columnsSourceRef.current != null &&
          columnsSourceRef.current.workbook === workbookName &&
          columnsSourceRef.current.sheet !== resolvedSheet;
        columnsSourceRef.current = {
          workbook: workbookName,
          sheet: resolvedSheet,
        };
        setWorksheets(nextSheets);
        setColumns(nextColumns);
        setForm((prev) => {
          if (!prev) return prev;
          if (prev.referenceSheetName.trim() !== workbookName) return prev;
          const nextWorksheet = nextSheets.includes(prev.referenceWorksheetName)
            ? prev.referenceWorksheetName
            : resolvedSheet;
          const resolvedName = resolveColumnSelection(
            nextColumns,
            prev.childNameColumn
          );
          const resolvedEdc = resolveColumnSelection(
            nextColumns,
            prev.edcColumn
          );
          const resetColumns = workbookChanged || sheetChanged;
          const childNameColumn =
            resolvedName || (resetColumns ? "" : prev.childNameColumn);
          const edcColumn = resolvedEdc || (resetColumns ? "" : prev.edcColumn);
          if (
            nextWorksheet === prev.referenceWorksheetName &&
            childNameColumn === prev.childNameColumn &&
            edcColumn === prev.edcColumn
          ) {
            return prev;
          }
          return {
            ...prev,
            referenceWorksheetName: nextWorksheet,
            childNameColumn,
            edcColumn,
          };
        });
      } catch (error) {
        if (controller.signal.aborted || isBenignFetchInterruption(error))
          return;
        setColumns([]);
        setColumnsError(
          error instanceof Error
            ? error.message
            : "Could not load workbook columns"
        );
      } finally {
        if (!controller.signal.aborted) setColumnsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [connected, editing, workbookName, worksheetName]);

  const folderItems = useMemo(() => {
    const names = new Set(folders.map((folder) => folder.name));
    const extras =
      form?.folderName && !names.has(form.folderName)
        ? [{ id: `current-${form.folderName}`, name: form.folderName }]
        : [];
    return [...extras, ...folders].map((folder) => ({
      label: folder.name,
      value: folder.name,
    }));
  }, [folders, form]);

  const workbookItems = useMemo(() => {
    const names = new Set(workbooks.map((file) => file.name));
    const current = form?.referenceSheetName;
    const extras =
      current && !names.has(current)
        ? [{ id: `current-${current}`, name: current }]
        : [];
    return [...extras, ...workbooks].map((file) => ({
      label: file.name,
      value: file.name,
    }));
  }, [workbooks, form]);

  const worksheetItems = useMemo(() => {
    const names = new Set(worksheets);
    const current = form?.referenceWorksheetName;
    const extras = current && !names.has(current) ? [current] : [];
    return [...extras, ...worksheets].map((sheet) => ({
      label: sheet,
      value: sheet,
    }));
  }, [worksheets, form]);

  const nameColumnItems = useMemo(
    () =>
      columnsToSelectItems(
        columns,
        NAME_COLUMN_KINDS,
        form?.childNameColumn ?? ""
      ),
    [columns, form?.childNameColumn]
  );

  const edcColumnItems = useMemo(
    () =>
      columnsToSelectItems(columns, EDC_COLUMN_KINDS, form?.edcColumn ?? ""),
    [columns, form?.edcColumn]
  );

  const sameColumnsSelected = Boolean(
    form?.childNameColumn.trim() &&
    form.childNameColumn.trim().toLowerCase() ===
      form.edcColumn.trim().toLowerCase()
  );

  const closeEmailPanel = () => {
    setEmailPanel(null);
    setNewEmail("");
    setPendingRemoveEmail(null);
  };

  const cancel = () => {
    if (saved) setForm(saved);
    setEditing(false);
    closeEmailPanel();
  };

  const confirmAddEmail = () => {
    const email = normalizeEmail(newEmail);
    if (!email) {
      notify({ type: "error", message: "Enter an email address." });
      return;
    }
    if (!isValidEmail(email)) {
      notify({ type: "error", message: "Enter a valid email address." });
      return;
    }
    setForm((prev) => {
      if (!prev) return prev;
      if (prev.allowedAdminEmails.includes(email)) {
        notify({
          type: "error",
          message: "That email is already on the list.",
        });
        return prev;
      }
      return {
        ...prev,
        allowedAdminEmails: [...prev.allowedAdminEmails, email],
      };
    });
    setNewEmail("");
    setPendingRemoveEmail(null);
  };

  const requestRemoveEmail = (email: string) => {
    if (pendingRemoveEmail === email) {
      setForm((prev) =>
        prev
          ? {
              ...prev,
              allowedAdminEmails: prev.allowedAdminEmails.filter(
                (entry) => entry !== email
              ),
            }
          : prev
      );
      setPendingRemoveEmail(null);
      return;
    }
    setPendingRemoveEmail(email);
  };

  const save = async () => {
    if (!form) return;
    if (!form.folderName.trim()) {
      notify({ type: "error", message: "Upload folder is required." });
      return;
    }
    if (!form.referenceSheetName.trim()) {
      notify({ type: "error", message: "Reference workbook is required." });
      return;
    }
    if (!form.referenceWorksheetName.trim()) {
      notify({ type: "error", message: "Workbook page is required." });
      return;
    }
    if (!form.childNameColumn.trim()) {
      notify({ type: "error", message: "Child name column is required." });
      return;
    }
    if (!form.edcColumn.trim()) {
      notify({ type: "error", message: "EDC column is required." });
      return;
    }
    if (
      form.childNameColumn.trim().toLowerCase() ===
      form.edcColumn.trim().toLowerCase()
    ) {
      notify({
        type: "error",
        message: "Child name column and EDC column cannot be the same.",
      });
      return;
    }
    if (parseDurationInput(form.bufferValue) === null) {
      notify({
        type: "error",
        message: "Link buffer requires a number (0 or greater).",
      });
      return;
    }
    if (parseDurationInput(form.expiryValue) === null) {
      notify({
        type: "error",
        message: "Link availability requires a number.",
      });
      return;
    }
    if (parseDurationInput(form.expiryValue) === 0) {
      notify({
        type: "error",
        message: "Link availability must be greater than 0.",
      });
      return;
    }
    if (form.allowedAdminEmails.length === 0) {
      notify({
        type: "error",
        message: "Add at least one allowed admin email.",
      });
      return;
    }

    setSaving(true);
    const savingToast = toast.loading("Saving settings...");
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToConfigPatch(form)),
      });
      const data = (await res.json()) as AppConfig & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not save settings");
      }
      const nextForm = configToForm(data);
      setForm(nextForm);
      setSaved(nextForm);
      setEditing(false);
      closeEmailPanel();
      toast.success("Settings saved.", { id: savingToast });
      onConfigSaved?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save settings";
      toast.error(message, { id: savingToast });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex min-h-0 flex-col overflow-y-auto overscroll-contain rounded-sm border border-[#02182B]/15 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-heading text-base font-semibold">Settings</span>
        {!editing ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!connected || loading || !form}
            onClick={() => {
              columnsSourceRef.current = null;
              setColumns([]);
              setWorksheets([]);
              setColumnsError(null);
              setEditing(true);
              closeEmailPanel();
              void loadBrowse();
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
        <p className="mt-4 text-sm text-[#02182B]/50">
          Connect a SharePoint site to manage upload settings.
        </p>
      ) : loading || !form ? (
        <p className="mt-4 text-sm text-[#02182B]/50">Loading settings…</p>
      ) : (
        <div className="mt-4 flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-folder">Upload folder</Label>
            <Combobox
              id="settings-folder"
              items={folderItems}
              value={form.folderName}
              onValueChange={(value) => {
                if (!value) return;
                setForm((prev) =>
                  prev ? { ...prev, folderName: value } : prev
                );
              }}
              placeholder={
                browseLoading
                  ? "Loading folders…"
                  : "Search libraries and folders"
              }
              emptyText="No matching folders."
              disabled={!editing || browseLoading}
            />
            <p className="text-xs text-[#02182B]/45">
              Libraries and nested folders, shown as a path (for example GMA
              Video/Inbox). Uploads go to that folder, not the site root.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-workbook">Reference workbook</Label>
            <Select
              items={workbookItems}
              value={form.referenceSheetName}
              onValueChange={(value) => {
                if (typeof value !== "string") return;
                setForm((prev) => {
                  if (!prev || value === prev.referenceSheetName) return prev;
                  return {
                    ...prev,
                    referenceSheetName: value,
                    referenceWorksheetName: "",
                    childNameColumn: "",
                    edcColumn: "",
                  };
                });
              }}
              disabled={!editing || browseLoading}
            >
              <SelectTrigger id="settings-workbook" className="w-full">
                <SelectValue
                  placeholder={
                    browseLoading ? "Loading workbooks…" : "Select an .xlsx file"
                  }
                />
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-worksheet">Workbook page</Label>
            <Select
              items={worksheetItems}
              value={form.referenceWorksheetName || null}
              onValueChange={(value) => {
                if (typeof value !== "string") return;
                setForm((prev) => {
                  if (!prev || value === prev.referenceWorksheetName)
                    return prev;
                  return {
                    ...prev,
                    referenceWorksheetName: value,
                    childNameColumn: "",
                    edcColumn: "",
                  };
                });
              }}
              disabled={!editing || !form.referenceSheetName.trim()}
            >
              <SelectTrigger id="settings-worksheet" className="w-full">
                <SelectValue
                  placeholder={
                    columnsLoading && !form.referenceWorksheetName
                      ? "Loading pages…"
                      : "Select a page"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {worksheetItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-child-column">Child name column</Label>
              <Select
                items={nameColumnItems}
                value={form.childNameColumn || null}
                onValueChange={(value) => {
                  if (typeof value !== "string") return;
                  setForm((prev) =>
                    prev ? { ...prev, childNameColumn: value } : prev
                  );
                }}
                disabled={
                  !editing ||
                  columnsLoading ||
                  !form.referenceSheetName.trim() ||
                  !form.referenceWorksheetName.trim()
                }
              >
                <SelectTrigger id="settings-child-column" className="w-full">
                  <SelectValue
                    placeholder={
                      columnsLoading
                        ? "Loading columns…"
                        : "Select a text column"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {nameColumnItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-edc-column">EDC column</Label>
              <Select
                items={edcColumnItems}
                value={form.edcColumn || null}
                onValueChange={(value) => {
                  if (typeof value !== "string") return;
                  setForm((prev) =>
                    prev ? { ...prev, edcColumn: value } : prev
                  );
                }}
                disabled={
                  !editing ||
                  columnsLoading ||
                  !form.referenceSheetName.trim() ||
                  !form.referenceWorksheetName.trim()
                }
              >
                <SelectTrigger id="settings-edc-column" className="w-full">
                  <SelectValue
                    placeholder={
                      columnsLoading
                        ? "Loading columns…"
                        : "Select a YYYY-MM-DD column"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {edcColumnItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p
            className={
              columnsError || sameColumnsSelected
                ? "-mt-2 text-xs text-red-600"
                : "-mt-2 text-xs text-[#02182B]/45"
            }
          >
            {columnsError
              ? columnsError
              : sameColumnsSelected
                ? "Child name column and EDC column cannot be the same."
                : "Choose a text column for the child’s name and a YYYY-MM-DD date column for EDC. They cannot be the same."}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DurationField
              id="settings-buffer"
              label="Link buffer"
              value={form.bufferValue}
              unit={form.bufferUnit}
              disabled={!editing}
              onValueChange={(value) => {
                setForm((prev) =>
                  prev ? { ...prev, bufferValue: value } : prev
                );
              }}
              onUnitChange={(unit) => {
                setForm((prev) =>
                  prev ? { ...prev, bufferUnit: unit } : prev
                );
              }}
            />
            <DurationField
              id="settings-expiry"
              label="Link availability"
              value={form.expiryValue}
              unit={form.expiryUnit}
              disabled={!editing}
              onValueChange={(value) => {
                setForm((prev) =>
                  prev ? { ...prev, expiryValue: value } : prev
                );
              }}
              onUnitChange={(unit) => {
                setForm((prev) =>
                  prev ? { ...prev, expiryUnit: unit } : prev
                );
              }}
            />
          </div>
          <p className="-mt-2 text-xs text-[#02182B]/45">
            Buffer delays when a new link becomes usable. Availability is how
            long the link stays valid after creation.
          </p>

          <div className="flex flex-col gap-2">
            <Label>Allowed admin emails</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setPendingRemoveEmail(null);
                  setEmailPanel("view");
                }}
              >
                View emails
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!editing}
                onClick={() => {
                  setPendingRemoveEmail(null);
                  setNewEmail("");
                  setEmailPanel("manage");
                }}
              >
                Add and remove emails
              </Button>
            </div>
            <p className="text-xs text-[#02182B]/45">
              These work accounts can open this admin console.
              {editing
                ? " Use Add and remove emails to change the list, then Save."
                : " Click Change first to add or remove addresses."}
            </p>
          </div>
        </div>
      )}

      {form && emailPanel ? (
        <AdminEmailsCard
          mode={emailPanel}
          emails={form.allowedAdminEmails}
          newEmail={newEmail}
          pendingRemoveEmail={pendingRemoveEmail}
          onNewEmailChange={setNewEmail}
          onAdd={confirmAddEmail}
          onRemove={requestRemoveEmail}
          onCancelPendingRemove={() => setPendingRemoveEmail(null)}
          onClose={closeEmailPanel}
        />
      ) : null}
    </section>
  );
}
