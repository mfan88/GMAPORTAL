"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, LinkIcon, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/ui/combobox";
import { Toaster } from "@/components/ui/sonner";
import SettingsCard from "@/components/settingsCard";
import DatePicker from "@/components/datePicker";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppConfig } from "@/lib/appConfig";
import { toast } from "sonner";

type ConnectionStatus = {
  connected: boolean;
  username: string | null;
  siteId?: string | null;
  siteUrl?: string | null;
  siteName?: string | null;
  writeAccess?: boolean;
  error?: string;
  tokenStorage?: string;
};

type LinkState = "scheduled" | "provisioning" | "pending" | "used";

type UploadLink = {
  token: string;
  url: string;
  createdAt: number;
  usedAt: number | null;
  state: LinkState;
  childName: string | null;
  edc: string | null;
  scheduledDate: string | null;
};

const STATE_BADGE: Record<LinkState, { label: string; dot: string }> = {
  scheduled: { label: "Scheduled", dot: "bg-teal-600" },
  provisioning: { label: "Provisioning", dot: "bg-amber-500" },
  pending: { label: "Pending Upload", dot: "bg-blue-500" },
  used: { label: "Used", dot: "bg-neutral-400" },
};

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
    );
  }

  const { label, dot } = STATE_BADGE[state];
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

type ReferenceChild = {
  name: string;
  edc: string | null;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function NotificationEmailsCard({
  mode,
  emails,
  adminEmails,
  newEmail,
  pendingRemoveEmail,
  disabled,
  onNewEmailChange,
  onAdd,
  onSelectAdmin,
  onRemove,
  onCancelPendingRemove,
  onClose,
}: Readonly<{
  mode: "view" | "manage";
  emails: string[];
  adminEmails: string[];
  newEmail: string;
  pendingRemoveEmail: string | null;
  disabled: boolean;
  onNewEmailChange: (value: string) => void;
  onAdd: () => void;
  onSelectAdmin: (email: string) => void;
  onRemove: (email: string) => void;
  onCancelPendingRemove: () => void;
  onClose: () => void;
}>) {
  const managing = mode === "manage";
  const unusedAdmins = adminEmails.filter((email) => !emails.includes(email));
  const adminItems = unusedAdmins.map((email) => ({
    label: email,
    value: email,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-emails-card-title"
        className="flex max-h-[min(36rem,calc(100vh-2rem))] w-full max-w-md flex-col rounded-xl border border-black/15 bg-background p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="notification-emails-card-title"
            className="text-sm font-medium"
          >
            {managing
              ? "Add and remove emails"
              : "Upload notification emails"}
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

        <ul className="mt-4 divide-y divide-black/10 overflow-y-auto rounded-lg border border-black/10">
          {emails.length === 0 ? (
            <li className="px-3 py-3 text-sm text-black/45">
              No notification emails yet.
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
                      disabled={disabled}
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
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="notification-admin-select" className="text-xs">
                Add from admin emails
              </Label>
              <Select
                items={adminItems}
                value={null}
                onValueChange={(next) => {
                  if (typeof next === "string" && next) onSelectAdmin(next);
                }}
                disabled={disabled || adminItems.length === 0}
              >
                <SelectTrigger
                  id="notification-admin-select"
                  className="w-full min-w-0"
                >
                  <SelectValue
                    placeholder={
                      adminItems.length === 0
                        ? "All admin emails are already added"
                        : "Select an admin email"
                    }
                  />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  alignItemWithTrigger={false}
                  className="z-[60]"
                >
                  <SelectGroup>
                    {unusedAdmins.map((email) => (
                      <SelectItem key={email} value={email}>
                        {email}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notification-new-email" className="text-xs">
                Or type an email
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="notification-new-email"
                  type="email"
                  placeholder="name@company.com"
                  value={newEmail}
                  disabled={disabled}
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
                <Button
                  type="button"
                  size="sm"
                  className="gap-1"
                  disabled={disabled}
                  onClick={onAdd}
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>
            </div>
            <p className="text-xs text-black/45">
              Click − once, then Confirm to remove. Changes save immediately.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ConsolePage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [links, setLinks] = useState<UploadLink[]>([]);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isConnectingSite, setIsConnectingSite] = useState(false);
  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [children, setChildren] = useState<ReferenceChild[]>([]);
  const [childNamesLoading, setChildNamesLoading] = useState(false);
  const [childNamesError, setChildNamesError] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [selectedEdc, setSelectedEdc] = useState<string | null>(null);
  const [isSchedulingLetter, setIsSchedulingLetter] = useState(false);
  const [letterScheduleDate, setLetterScheduleDate] = useState<
    Date | undefined
  >(undefined);
  const [allowedAdminEmails, setAllowedAdminEmails] = useState<string[]>([]);
  const [uploadNotificationEmails, setUploadNotificationEmails] = useState<
    string[]
  >([]);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationPanel, setNotificationPanel] = useState<
    "view" | "manage" | null
  >(null);
  const [newNotificationEmail, setNewNotificationEmail] = useState("");
  const [pendingRemoveNotification, setPendingRemoveNotification] = useState<
    string | null
  >(null);

  const loadStatus = useCallback(() => {
    void fetch("/api/auth/onedrive/status")
      .then((res) => res.json())
      .then((data: ConnectionStatus) => setStatus(data))
      .catch(() => setStatus({ connected: false, username: null }));
  }, []);

  const loadLinks = useCallback(() => {
    void fetch("/api/links")
      .then((res) => res.json())
      .then((data: { links?: UploadLink[]; error?: string }) => {
        setLinks(data.links ?? []);
        if (data.error) {
          toast.error(data.error);
        }
      })
      .catch(() => setLinks([]));
  }, []);

  const loadConfig = useCallback(() => {
    void fetch("/api/config")
      .then(async (res) => {
        const data = (await res.json()) as AppConfig & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not load settings");
        }
        setAllowedAdminEmails(data.allowedAdminEmails ?? []);
        setUploadNotificationEmails(data.uploadNotificationEmails ?? []);
      })
      .catch(() => {
        setAllowedAdminEmails([]);
        setUploadNotificationEmails([]);
      });
  }, []);

  const saveNotificationEmails = useCallback(
    async (emails: string[]) => {
      const next = [
        ...new Set(
          emails.map((email) => email.trim().toLowerCase()).filter(Boolean)
        ),
      ];
      const previous = uploadNotificationEmails;
      const same =
        next.length === previous.length &&
        next.every((email, index) => email === previous[index]);
      if (same) return;

      setUploadNotificationEmails(next);
      setNotificationSaving(true);
      const savingToast = toast.loading("Saving notification emails...");
      try {
        const res = await fetch("/api/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadNotificationEmails: next }),
        });
        const data = (await res.json()) as AppConfig & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not save notification emails");
        }
        setAllowedAdminEmails(data.allowedAdminEmails ?? []);
        setUploadNotificationEmails(data.uploadNotificationEmails ?? []);
        toast.success("Notification emails saved.", { id: savingToast });
      } catch (error) {
        setUploadNotificationEmails(previous);
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not save notification emails",
          { id: savingToast }
        );
      } finally {
        setNotificationSaving(false);
      }
    },
    [uploadNotificationEmails]
  );

  const closeNotificationPanel = () => {
    setNotificationPanel(null);
    setNewNotificationEmail("");
    setPendingRemoveNotification(null);
  };

  const addNotificationEmail = (raw: string) => {
    const email = normalizeEmail(raw);
    if (!email) {
      toast.error("Enter an email address.");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (uploadNotificationEmails.includes(email)) {
      toast.error("That email is already on the list.");
      return;
    }
    setNewNotificationEmail("");
    setPendingRemoveNotification(null);
    void saveNotificationEmails([...uploadNotificationEmails, email]);
  };

  const requestRemoveNotificationEmail = (email: string) => {
    if (pendingRemoveNotification === email) {
      setPendingRemoveNotification(null);
      void saveNotificationEmails(
        uploadNotificationEmails.filter((entry) => entry !== email)
      );
      return;
    }
    setPendingRemoveNotification(email);
  };

  const loadChildNames = useCallback(() => {
    setChildNamesLoading(true);
    setChildNamesError(null);
    void fetch("/api/onedrive/child-names")
      .then(async (res) => {
        const data = (await res.json()) as {
          children?: ReferenceChild[];
          names?: string[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not load child names");
        }
        const nextChildren =
          data.children ??
          (data.names ?? []).map((name) => ({ name, edc: null }));
        setChildren(nextChildren);
        setSelectedChild((current) =>
          current && nextChildren.some((child) => child.name === current)
            ? current
            : null
        );
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Could not load child names";
        setChildren([]);
        setSelectedChild(null);
        setChildNamesError(message);
      })
      .finally(() => setChildNamesLoading(false));
  }, []);

  useEffect(() => {
    loadStatus();
    loadLinks();
    loadConfig();

    // Poll so link states (Provisioning -> Pending Upload -> Used) stay
    // current without a manual refresh.
    const interval = window.setInterval(loadLinks, 15000);

    const params = new URLSearchParams(window.location.search);
    const connectedParam = params.get("connected") === "1";
    const grantedParam = params.get("granted") === "1";
    const errorParam = params.get("error");
    let bannerTimeout: number | undefined;
    if (connectedParam || grantedParam || errorParam) {
      bannerTimeout = window.setTimeout(() => {
        if (grantedParam) {
          toast.success(
            "App write access granted on the SharePoint site. Uploads should work now."
          );
          loadStatus();
        } else if (connectedParam) {
          toast.success(
            "SharePoint site connected and ready to receive uploads."
          );
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
          };
          toast.error(setupErrors[errorParam] ?? errorParam);
        }
      }, 0);
    }

    return () => {
      window.clearInterval(interval);
      if (bannerTimeout !== undefined) {
        window.clearTimeout(bannerTimeout);
      }
    };
  }, [loadStatus, loadLinks, loadConfig]);

  const portalLinkUrl = useCallback((token: string) => {
    return `${window.location.origin}/portalaccess/${encodeURIComponent(token)}`;
  }, []);

  const copyLink = useCallback(
    async (link: UploadLink) => {
      try {
        await navigator.clipboard.writeText(portalLinkUrl(link.token));
        setCopiedToken(link.token);
        window.setTimeout(() => {
          setCopiedToken((current) =>
            current === link.token ? null : current
          );
        }, 2000);
      } catch {
        toast.error("Could not copy to clipboard");
      }
    },
    [portalLinkUrl]
  );

  const removeLink = useCallback(
    async (token: string) => {
      setLinks((prev) => prev.filter((link) => link.token !== token));
      try {
        await fetch("/api/links", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      } catch {
        loadLinks();
      }
    },
    [loadLinks]
  );

  const requestRemoveLink = useCallback(
    (link: UploadLink) => {
      if (link.state !== "used") {
        const confirmed = window.confirm(
          "Are you sure you want to delete this unused link? Anyone with the link will no longer be able to upload."
        );
        if (!confirmed) return;
      }
      void removeLink(link.token);
    },
    [removeLink]
  );

  const disconnect = useCallback(() => {
    setIsDisconnecting(true);
    void fetch("/api/auth/onedrive/status", { method: "DELETE" })
      .then(() => {
        setStatus({ connected: false, username: null });
        setSiteUrlInput("");
        toast.success("SharePoint site disconnected.");
        setChildren([]);
        setSelectedChild(null);
        setSelectedEdc(null);
        setIsSchedulingLetter(false);
        setLetterScheduleDate(undefined);
        setChildNamesError(null);
      })
      .finally(() => setIsDisconnecting(false));
  }, []);

  const connectSite = useCallback(async () => {
    const siteUrl = siteUrlInput.trim();
    if (!siteUrl) {
      toast.error("Enter a SharePoint site URL (or Graph site id) first.");
      return;
    }

    setIsConnectingSite(true);
    const connectingToast = toast.loading("Connecting SharePoint site...");
    try {
      const res = await fetch("/api/sharepoint/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl }),
      });
      const data = (await res.json()) as ConnectionStatus & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not connect SharePoint site");
      }
      setStatus({
        connected: true,
        username: data.siteName ?? data.username ?? null,
        siteId: data.siteId,
        siteUrl: data.siteUrl,
        siteName: data.siteName,
      });
      toast.success(
        "SharePoint site connected. Next: grant write access if prompted.",
        { id: connectingToast }
      );
      loadStatus();
      loadChildNames();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not connect SharePoint site";
      toast.error(message, { id: connectingToast });
    } finally {
      setIsConnectingSite(false);
    }
  }, [loadChildNames, siteUrlInput]);

  const connected = Boolean(status?.connected);

  useEffect(() => {
    if (!connected) return;
    const timeout = window.setTimeout(() => {
      loadChildNames();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [connected, loadChildNames]);

  const workbookEdc =
    children.find((child) => child.name === selectedChild)?.edc ?? null;

  let edcStatement: string | null = null;
  if (selectedChild && workbookEdc) {
    edcStatement = `EDC on file for ${selectedChild}: ${workbookEdc}. Age in weeks will be calculated from this EDC to the date the parent records on upload.`;
  } else if (selectedChild) {
    edcStatement = `No EDC on file for ${selectedChild}. Enter one below to generate a link.`;
  }

  const childItems = useMemo(
    () =>
      children.map((child) => ({
        label: child.name,
        value: child.name,
      })),
    [children]
  );

  const applyChildSelection = (value: string | null) => {
    if (!value) {
      setSelectedChild(null);
      setSelectedEdc(null);
      return;
    }
    const nextEdc = children.find((child) => child.name === value)?.edc ?? null;
    setSelectedChild(value);
    setSelectedEdc(nextEdc);
  };

  const generateLink = useCallback(() => {
    if (!selectedChild || !selectedEdc) {
      toast.error(
        "Select a child with a valid EDC date before generating a link."
      );
      return;
    }

    if (isSchedulingLetter && !letterScheduleDate) {
      toast.error("Pick the letter schedule date before generating a link.");
      return;
    }

    const scheduledDate = isSchedulingLetter
      ? format(letterScheduleDate!, "yyyy-MM-dd")
      : null;

    setIsGenerating(true);
    const generatingToast = toast.loading("Generating link...");
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
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not generate link");
        }
        loadLinks();
        toast.success("Link generated.", { id: generatingToast });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Could not generate link";
        toast.error(message, { id: generatingToast });
      })
      .finally(() => setIsGenerating(false));
  }, [
    isSchedulingLetter,
    letterScheduleDate,
    loadLinks,
    selectedChild,
    selectedEdc,
  ]);

  const canGenerateLink =
    connected &&
    Boolean(selectedChild) &&
    Boolean(selectedEdc) &&
    (!isSchedulingLetter || Boolean(letterScheduleDate)) &&
    !isGenerating;

  const childPickerContent = (() => {
    if (!connected) {
      return (
        <p className="text-sm text-black/50">
          Connect a SharePoint site to load children from the reference
          workbook.
        </p>
      );
    }
    if (childNamesLoading) {
      return (
        <p className="text-sm text-black/50">Loading children from workbook…</p>
      );
    }
    if (childNamesError) {
      return <p className="text-sm text-red-600">{childNamesError}</p>;
    }
    if (childItems.length === 0) {
      return (
        <p className="text-sm text-black/50">
          No names found in the configured child name column. Check Settings.
        </p>
      );
    }
    return (
      <>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="child-select">Child</Label>
          <Combobox
            id="child-select"
            items={childItems}
            value={selectedChild}
            onValueChange={applyChildSelection}
            placeholder="Search or select a child"
            emptyText="No matching names."
          />
        </div>
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
                setSelectedEdc(event.target.value || null);
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
                  const scheduling = checked === true;
                  setIsSchedulingLetter(scheduling);
                  if (!scheduling) {
                    setLetterScheduleDate(undefined);
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
                  The portal link stays unavailable until this date. On that day
                  the activation buffer begins.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </>
    );
  })();

  return (
    <div className="flex min-h-dvh w-full flex-col bg-white text-black lg:h-dvh lg:max-h-dvh lg:overflow-hidden">
      <header className="box-border flex shrink-0 items-start justify-between gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Image
            className="h-10 w-auto sm:h-14 lg:h-16"
            src="/images/dda-logo.svg"
            alt="DDA logo"
            width={1338}
            height={472}
          />
          <Link
            href="/"
            className="w-fit text-xs underline underline-offset-4 sm:text-sm"
          >
            {"<<<"} Back to upload portal
          </Link>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => {
            window.location.assign("/api/auth/admin/logout");
          }}
        >
          Sign out
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-3 pb-6 sm:px-6 lg:min-h-0 lg:overflow-hidden lg:pb-4">
        <h1 className="shrink-0 px-1 text-center text-lg font-medium sm:text-2xl lg:text-3xl">
          General Movements Assessment (GMA) Video Portal Console
        </h1>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:overflow-hidden">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-black/15 p-4 shadow-sm sm:p-5 lg:min-h-0">
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
                write access (requires Entra delegated Sites.FullControl.All + a
                SharePoint/Global admin).
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {!connected ? (
                <Button
                  size="sm"
                  disabled={isConnectingSite}
                  onClick={() => {
                    void connectSite();
                  }}
                >
                  {isConnectingSite
                    ? "Connecting..."
                    : "Connect SharePoint site"}
                </Button>
              ) : (
                <>
                  {status?.writeAccess !== true ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        window.location.assign(
                          "/api/auth/sharepoint/grant-access"
                        );
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

            <div className="mt-4 flex flex-col gap-2">
              <Label>Upload notification emails</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPendingRemoveNotification(null);
                    setNotificationPanel("view");
                  }}
                >
                  View emails
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={notificationSaving}
                  onClick={() => {
                    setPendingRemoveNotification(null);
                    setNewNotificationEmail("");
                    setNotificationPanel("manage");
                  }}
                >
                  Add and remove emails
                </Button>
              </div>
              <p className="text-xs text-black/45">
                These addresses receive a message when a parent upload succeeds.
                Choose an admin email or type any address.
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

            <div className="mt-3 max-h-64 min-h-0 overflow-y-auto overscroll-contain pr-1 sm:max-h-80 lg:max-h-none lg:flex-1">
              {links.length === 0 ? (
                <p className="text-sm text-black/40">
                  No active links yet. Generate one to share with a parent.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {links.map((link) => {
                    const isCopied = copiedToken === link.token;
                    const isUsed = link.state === "used";
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
                    );
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
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-y-auto overscroll-contain rounded-xl border border-black/15 p-4 shadow-sm sm:p-6">
            <div className="flex flex-1 flex-col gap-3">
              <span className="text-sm font-medium">Create New Link</span>
              {childPickerContent}
            </div>
            <Button
              className="mt-4 py-4 sm:py-10"
              size="sm"
              disabled={!canGenerateLink}
              onClick={generateLink}
            >
              {isGenerating ? "Generating..." : "Generate new link"}
            </Button>
          </section>

          <SettingsCard
            connected={connected}
            onConfigSaved={() => {
              loadChildNames();
              loadConfig();
            }}
          />
        </div>
      </main>
      {notificationPanel ? (
        <NotificationEmailsCard
          mode={notificationPanel}
          emails={uploadNotificationEmails}
          adminEmails={allowedAdminEmails}
          newEmail={newNotificationEmail}
          pendingRemoveEmail={pendingRemoveNotification}
          disabled={notificationSaving}
          onNewEmailChange={setNewNotificationEmail}
          onAdd={() => addNotificationEmail(newNotificationEmail)}
          onSelectAdmin={addNotificationEmail}
          onRemove={requestRemoveNotificationEmail}
          onCancelPendingRemove={() => setPendingRemoveNotification(null)}
          onClose={closeNotificationPanel}
        />
      ) : null}
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
