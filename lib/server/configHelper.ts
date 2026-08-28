import { type AppConfig, DEFAULT_APP_CONFIG } from "../appConfig";
import { getRedis } from "./redis";

const CONFIG_KEY = "app:config";

export { DEFAULT_APP_CONFIG };

type AppConfigOverrides = {
  folderName?: string;
  bufferTimeMs?: number;
  linkExpiryTimeMs?: number;
  fileDetails?: Partial<AppConfig["fileDetails"]>;
  referenceSheetName?: string;
  referenceWorksheetName?: string;
  childNameColumn?: string;
  edcColumn?: string;
  allowedAdminEmails?: string[];
  uploadNotificationEmails?: string[];
  /** @deprecated Read/write alias for a single notification email. */
  uploadNotificationEmail?: string;
  sharePointSiteId?: string;
  sharePointSiteUrl?: string;
  sharePointSiteName?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/**
 * Like asNonEmptyString, but preserves an explicit "" so callers (e.g.
 * clearOneDriveConnection) can intentionally blank out a saved value.
 */
function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function asEmailList(value: unknown): string[] | undefined {
  if (typeof value === "string") {
    const emails = value
      .split(/[\n,;]+/)
      .map(normalizeEmail)
      .filter(Boolean);
    return emails.length > 0 ? [...new Set(emails)] : [];
  }
  if (!Array.isArray(value)) return undefined;
  const emails = value
    .filter((entry): entry is string => typeof entry === "string")
    .map(normalizeEmail)
    .filter(Boolean);
  return [...new Set(emails)];
}

function asNotificationEmails(
  raw: Record<string, unknown>
): string[] | undefined {
  if ("uploadNotificationEmails" in raw) {
    return asEmailList(raw.uploadNotificationEmails) ?? [];
  }
  if ("uploadNotificationEmail" in raw) {
    const single = asOptionalString(raw.uploadNotificationEmail);
    if (single === undefined) return undefined;
    return single ? [normalizeEmail(single)] : [];
  }
  return undefined;
}

function normalizeOverrides(raw: unknown): AppConfigOverrides {
  if (!isPlainObject(raw)) return {};

  const fileDetailsRaw = raw.fileDetails;
  const fileDetails = isPlainObject(fileDetailsRaw)
    ? {
        maxFileCount: asPositiveNumber(fileDetailsRaw.maxFileCount),
        maxFileSizeBytes: asPositiveNumber(fileDetailsRaw.maxFileSizeBytes),
        maxSimpleFileSizeBytes: asPositiveNumber(
          fileDetailsRaw.maxSimpleFileSizeBytes
        ),
        uploadChunkSizeBytes: asPositiveNumber(
          fileDetailsRaw.uploadChunkSizeBytes
        ),
      }
    : undefined;

  return {
    folderName: asNonEmptyString(raw.folderName),
    bufferTimeMs: asPositiveNumber(raw.bufferTimeMs),
    linkExpiryTimeMs: asPositiveNumber(raw.linkExpiryTimeMs),
    referenceSheetName: asNonEmptyString(raw.referenceSheetName),
    referenceWorksheetName: asNonEmptyString(raw.referenceWorksheetName),
    childNameColumn: asNonEmptyString(raw.childNameColumn),
    edcColumn: asNonEmptyString(raw.edcColumn),
    allowedAdminEmails: asEmailList(raw.allowedAdminEmails),
    uploadNotificationEmails: asNotificationEmails(raw),
    sharePointSiteId: asOptionalString(raw.sharePointSiteId),
    sharePointSiteUrl: asOptionalString(raw.sharePointSiteUrl),
    sharePointSiteName: asOptionalString(raw.sharePointSiteName),
    fileDetails,
  };
}

function mergeConfig(overrides: AppConfigOverrides): AppConfig {
  return {
    folderName: overrides.folderName ?? DEFAULT_APP_CONFIG.folderName,
    bufferTimeMs: overrides.bufferTimeMs ?? DEFAULT_APP_CONFIG.bufferTimeMs,
    linkExpiryTimeMs:
      overrides.linkExpiryTimeMs ?? DEFAULT_APP_CONFIG.linkExpiryTimeMs,
    referenceSheetName:
      overrides.referenceSheetName ?? DEFAULT_APP_CONFIG.referenceSheetName,
    referenceWorksheetName:
      overrides.referenceWorksheetName ??
      DEFAULT_APP_CONFIG.referenceWorksheetName,
    childNameColumn:
      overrides.childNameColumn ?? DEFAULT_APP_CONFIG.childNameColumn,
    edcColumn: overrides.edcColumn ?? DEFAULT_APP_CONFIG.edcColumn,
    allowedAdminEmails:
      overrides.allowedAdminEmails ?? DEFAULT_APP_CONFIG.allowedAdminEmails,
    uploadNotificationEmails:
      overrides.uploadNotificationEmails ??
      DEFAULT_APP_CONFIG.uploadNotificationEmails,
    sharePointSiteId:
      overrides.sharePointSiteId ?? DEFAULT_APP_CONFIG.sharePointSiteId,
    sharePointSiteUrl:
      overrides.sharePointSiteUrl ?? DEFAULT_APP_CONFIG.sharePointSiteUrl,
    sharePointSiteName:
      overrides.sharePointSiteName ?? DEFAULT_APP_CONFIG.sharePointSiteName,
    acceptedUploadTypes: DEFAULT_APP_CONFIG.acceptedUploadTypes,
    fileDetails: {
      ...DEFAULT_APP_CONFIG.fileDetails,
      ...Object.fromEntries(
        Object.entries(overrides.fileDetails ?? {}).filter(
          ([, value]) => value !== undefined
        )
      ),
    },
  };
}

function notificationEmailsOnAllowlist(
  emails: string[] | undefined,
  allowed: string[]
) {
  if (!emails?.length) return [];
  return [
    ...new Set(
      emails
        .map(normalizeEmail)
        .filter((email) => email.length > 0 && allowed.includes(email))
    ),
  ];
}

/** Effective config: Redis overrides merged over code defaults. */
export async function getAppConfig(): Promise<AppConfig> {
  try {
    const raw = await getRedis().get<unknown>(CONFIG_KEY);
    const merged = mergeConfig(normalizeOverrides(raw));
    const allowedAdminEmails = [
      ...new Set([
        ...merged.allowedAdminEmails.map(normalizeEmail),
        ...envAllowedAdminEmails(),
      ]),
    ];
    return {
      ...merged,
      allowedAdminEmails,
      uploadNotificationEmails: notificationEmailsOnAllowlist(
        merged.uploadNotificationEmails,
        allowedAdminEmails
      ),
    };
  } catch {
    const allowedAdminEmails = envAllowedAdminEmails();
    return {
      ...DEFAULT_APP_CONFIG,
      fileDetails: { ...DEFAULT_APP_CONFIG.fileDetails },
      allowedAdminEmails,
      uploadNotificationEmails: notificationEmailsOnAllowlist(
        DEFAULT_APP_CONFIG.uploadNotificationEmails,
        allowedAdminEmails
      ),
    };
  }
}

function resolveNotificationEmailsPatch(
  patch: AppConfigOverrides,
  existing: AppConfigOverrides
): string[] | undefined {
  if (patch.uploadNotificationEmails !== undefined) {
    return [
      ...new Set(
        patch.uploadNotificationEmails.map(normalizeEmail).filter(Boolean)
      ),
    ];
  }
  if (typeof patch.uploadNotificationEmail === "string") {
    const single = normalizeEmail(patch.uploadNotificationEmail);
    return single ? [single] : [];
  }
  return existing.uploadNotificationEmails;
}

export async function updateAppConfig(
  patch: AppConfigOverrides
): Promise<AppConfig> {
  const redis = getRedis();
  const existing = normalizeOverrides(await redis.get<unknown>(CONFIG_KEY));
  const next: AppConfigOverrides = {
    folderName: patch.folderName ?? existing.folderName,
    bufferTimeMs: patch.bufferTimeMs ?? existing.bufferTimeMs,
    linkExpiryTimeMs: patch.linkExpiryTimeMs ?? existing.linkExpiryTimeMs,
    referenceSheetName: patch.referenceSheetName ?? existing.referenceSheetName,
    referenceWorksheetName:
      patch.referenceWorksheetName ?? existing.referenceWorksheetName,
    childNameColumn: patch.childNameColumn ?? existing.childNameColumn,
    edcColumn: patch.edcColumn ?? existing.edcColumn,
    allowedAdminEmails: patch.allowedAdminEmails ?? existing.allowedAdminEmails,
    uploadNotificationEmails: resolveNotificationEmailsPatch(patch, existing),
    sharePointSiteId: patch.sharePointSiteId ?? existing.sharePointSiteId,
    sharePointSiteUrl: patch.sharePointSiteUrl ?? existing.sharePointSiteUrl,
    sharePointSiteName: patch.sharePointSiteName ?? existing.sharePointSiteName,
    fileDetails: {
      ...existing.fileDetails,
      ...patch.fileDetails,
    },
  };

  const childNameColumn = next.childNameColumn?.trim();
  const edcColumn = next.edcColumn?.trim();
  if (
    childNameColumn &&
    edcColumn &&
    childNameColumn.toLowerCase() === edcColumn.toLowerCase()
  ) {
    throw new Error("Child name column and EDC column cannot be the same.");
  }

  const allowedAdminEmails = [
    ...new Set([
      ...(
        next.allowedAdminEmails ??
        existing.allowedAdminEmails ??
        DEFAULT_APP_CONFIG.allowedAdminEmails
      ).map((email) => normalizeEmail(email)),
      ...envAllowedAdminEmails(),
    ]),
  ];
  const notify = notificationEmailsOnAllowlist(
    next.uploadNotificationEmails,
    allowedAdminEmails
  );
  const patchTouchesNotification =
    patch.uploadNotificationEmails !== undefined ||
    typeof patch.uploadNotificationEmail === "string";
  if (
    patchTouchesNotification &&
    (next.uploadNotificationEmails ?? []).some(
      (email) => email && !allowedAdminEmails.includes(normalizeEmail(email))
    )
  ) {
    throw new Error(
      "Upload notification emails must be allowlisted admin emails."
    );
  }
  next.uploadNotificationEmails = notify;

  await redis.set(CONFIG_KEY, next);
  return getAppConfig();
}

export async function resetAppConfig(): Promise<AppConfig> {
  await getRedis().del(CONFIG_KEY);
  return {
    ...DEFAULT_APP_CONFIG,
    fileDetails: { ...DEFAULT_APP_CONFIG.fileDetails },
    allowedAdminEmails: [...DEFAULT_APP_CONFIG.allowedAdminEmails],
  };
}

function envAllowedAdminEmails(): string[] {
  return asEmailList(process.env.ALLOWED_ADMIN_EMAILS) ?? [];
}

/** Effective admin allowlist (Settings + ALLOWED_ADMIN_EMAILS env). */
export async function getAllowedAdminEmails(): Promise<string[]> {
  const config = await getAppConfig();
  return config.allowedAdminEmails.map(normalizeEmail);
}

export async function isAllowedAdminEmail(
  email: string | null | undefined
): Promise<boolean> {
  const normalized = typeof email === "string" ? normalizeEmail(email) : "";
  if (!normalized) return false;
  const allowed = await getAllowedAdminEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(normalized);
}

export async function adminAllowlistRejectionReason(
  email: string | null | undefined
): Promise<"no_admins_configured" | "unauthorized_admin" | null> {
  const allowed = await getAllowedAdminEmails();
  if (allowed.length === 0) return "no_admins_configured";
  const normalized = typeof email === "string" ? normalizeEmail(email) : "";
  if (!normalized || !allowed.includes(normalized)) {
    return "unauthorized_admin";
  }
  return null;
}
