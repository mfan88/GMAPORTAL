import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";
import { getAppConfig } from "./configHelper";

const LINK_PREFIX = "link:";

/**
 * Link lifecycle in the admin console:
 * - "scheduled": letter date not reached yet (portal shows expired/not found).
 * - "provisioning": buffer window after the letter date (not usable yet).
 * - "pending": active and waiting for a parent to upload.
 * - "used": consumed by a successful upload; kept until admin dismisses it.
 */
export type LinkState = "scheduled" | "provisioning" | "pending" | "used";

export type UploadLink = {
  token: string;
  createdAt: number;
  usedAt: number | null;
  state: LinkState;
  childName: string | null;
  /** ISO date (YYYY-MM-DD) used to compute age at upload from date recorded. */
  edc: string | null;
  /**
   * When the activation buffer begins (ms). Defaults to createdAt when the
   * letter was not scheduled ahead.
   */
  bufferStartsAt: number;
  /** Earliest time the parent may upload (bufferStartsAt + buffer). */
  availableAt: number;
  /** Latest time the parent may upload (set when the link is created). */
  expiresAt: number;
  /** ISO date (YYYY-MM-DD) when a letter was scheduled, if any. */
  scheduledDate: string | null;
};

type StoredLink = {
  createdAt: number;
  usedAt?: number;
  childName?: string;
  edc?: string;
  /** Absolute expiry timestamp (ms). Older links may omit this. */
  expiresAt?: number;
  /**
   * When the buffer countdown begins (ms). Older links omit this and use
   * createdAt.
   */
  bufferStartsAt?: number;
  /** ISO date (YYYY-MM-DD) chosen when scheduling the letter. */
  scheduledDate?: string;
  /** @deprecated Older links stored age at generation; prefer `edc`. */
  ageWeeks?: number;
};

let redisClient: Redis | null = null;

/** Shared Upstash Redis client (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN). */
export function getRedis() {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

function resolveBufferStartsAt(value: StoredLink): number {
  if (
    typeof value.bufferStartsAt === "number" &&
    Number.isFinite(value.bufferStartsAt)
  ) {
    return value.bufferStartsAt;
  }
  return value.createdAt;
}

function startOfUtcDayFromIsoDate(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0);
}

function deriveState(
  value: StoredLink,
  bufferTimeMs: number,
  linkExpiryTimeMs: number
): LinkState {
  if (typeof value.usedAt === "number") return "used";

  const bufferStartsAt = resolveBufferStartsAt(value);
  const availableAt = bufferStartsAt + bufferTimeMs;
  const expiresAt =
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)
      ? value.expiresAt
      : availableAt + linkExpiryTimeMs;
  const now = Date.now();

  if (now >= expiresAt) return "used";
  if (now < bufferStartsAt) return "scheduled";
  if (now < availableAt) return "provisioning";
  return "pending";
}

function parseStoredEdc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Prefer normalizing to YYYY-MM-DD when parseable.
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toUploadLink(
  token: string,
  value: StoredLink,
  bufferTimeMs: number,
  linkExpiryTimeMs: number
): UploadLink {
  const bufferStartsAt = resolveBufferStartsAt(value);
  const availableAt = bufferStartsAt + bufferTimeMs;
  const expiresAt =
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)
      ? value.expiresAt
      : availableAt + linkExpiryTimeMs;

  return {
    token,
    createdAt: value.createdAt,
    usedAt: value.usedAt ?? null,
    state: deriveState(value, bufferTimeMs, linkExpiryTimeMs),
    childName:
      typeof value.childName === "string" && value.childName.trim()
        ? value.childName.trim()
        : null,
    edc: parseStoredEdc(value.edc),
    bufferStartsAt,
    availableAt,
    expiresAt,
    scheduledDate: parseStoredEdc(value.scheduledDate),
  };
}

export async function createUploadLink(input: {
  childName: string;
  edc: string;
  /** Optional ISO date (YYYY-MM-DD). Buffer begins at UTC midnight that day. */
  scheduledDate?: string | null;
}): Promise<UploadLink> {
  const childName = input.childName.trim();
  const edc = parseStoredEdc(input.edc);
  if (!childName) {
    throw new Error("A child name is required to generate a link.");
  }
  if (!edc) {
    throw new Error("A valid EDC date is required to generate a link.");
  }

  const scheduledDate = input.scheduledDate
    ? parseStoredEdc(input.scheduledDate)
    : null;
  let bufferStartsAt = Date.now();
  if (scheduledDate) {
    const start = startOfUtcDayFromIsoDate(scheduledDate);
    if (start === null) {
      throw new Error("A valid letter schedule date is required.");
    }
    bufferStartsAt = start;
  }

  const config = await getAppConfig();
  const token = randomUUID();
  const createdAt = Date.now();
  const availableAt = bufferStartsAt + config.bufferTimeMs;
  const expiresAt = availableAt + config.linkExpiryTimeMs;
  const value: StoredLink = {
    createdAt,
    childName,
    edc,
    bufferStartsAt,
    expiresAt,
    ...(scheduledDate ? { scheduledDate } : {}),
  };

  const ttlSeconds = Math.max(60, Math.ceil((expiresAt - Date.now()) / 1000));

  await getRedis().set(`${LINK_PREFIX}${token}`, value, {
    ex: ttlSeconds,
  });

  return toUploadLink(
    token,
    value,
    config.bufferTimeMs,
    config.linkExpiryTimeMs
  );
}

export async function listLinks(): Promise<UploadLink[]> {
  const redis = getRedis();
  const { bufferTimeMs, linkExpiryTimeMs } = await getAppConfig();

  const tokens: string[] = [];
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, {
      match: `${LINK_PREFIX}*`,
      count: 100,
    });
    cursor = String(next);
    for (const key of keys) {
      tokens.push(key.slice(LINK_PREFIX.length));
    }
  } while (cursor !== "0");

  if (tokens.length === 0) return [];

  const values = await redis.mget<Array<StoredLink | null>>(
    ...tokens.map((token) => `${LINK_PREFIX}${token}`)
  );

  const links: UploadLink[] = [];
  tokens.forEach((token, index) => {
    const value = values[index];
    if (value && typeof value.createdAt === "number") {
      links.push(toUploadLink(token, value, bufferTimeMs, linkExpiryTimeMs));
    }
  });

  return links.sort((a, b) => b.createdAt - a.createdAt);
}

export async function removeUploadLink(token: string): Promise<void> {
  await getRedis().del(`${LINK_PREFIX}${token}`);
}

export type LinkStatus =
  | { status: "active" }
  | { status: "expired" }
  | { status: "pending"; availableAt: number };

export async function checkUploadLink(token: string): Promise<LinkStatus> {
  const value = await getRedis().get<StoredLink>(`${LINK_PREFIX}${token}`);
  if (!value || typeof value.createdAt !== "number") {
    return { status: "expired" };
  }

  if (typeof value.usedAt === "number") {
    return { status: "expired" };
  }

  const { bufferTimeMs, linkExpiryTimeMs } = await getAppConfig();
  const bufferStartsAt = resolveBufferStartsAt(value);
  const availableAt = bufferStartsAt + bufferTimeMs;
  const expiresAt =
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)
      ? value.expiresAt
      : availableAt + linkExpiryTimeMs;
  const now = Date.now();

  // Before the scheduled letter date: same as not found / expired (no countdown).
  if (now < bufferStartsAt) {
    return { status: "expired" };
  }

  if (now < availableAt) {
    return { status: "pending", availableAt };
  }

  if (now >= expiresAt) {
    return { status: "expired" };
  }

  return { status: "active" };
}

export async function getUploadLink(token: string): Promise<UploadLink | null> {
  const value = await getRedis().get<StoredLink>(`${LINK_PREFIX}${token}`);
  if (!value || typeof value.createdAt !== "number") return null;
  const { bufferTimeMs, linkExpiryTimeMs } = await getAppConfig();
  return toUploadLink(token, value, bufferTimeMs, linkExpiryTimeMs);
}

export async function uploadLinkUsable(token: string): Promise<boolean> {
  const value = await getRedis().get<StoredLink>(`${LINK_PREFIX}${token}`);
  if (
    !value ||
    typeof value.createdAt !== "number" ||
    typeof value.usedAt === "number"
  ) {
    return false;
  }

  const { bufferTimeMs, linkExpiryTimeMs } = await getAppConfig();
  const bufferStartsAt = resolveBufferStartsAt(value);
  const availableAt = bufferStartsAt + bufferTimeMs;
  const expiresAt =
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)
      ? value.expiresAt
      : availableAt + linkExpiryTimeMs;
  const now = Date.now();
  return now >= availableAt && now < expiresAt;
}

export async function consumeUploadLink(token: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${LINK_PREFIX}${token}`;

  const value = await redis.get<StoredLink>(key);
  if (
    !value ||
    typeof value.createdAt !== "number" ||
    typeof value.usedAt === "number"
  ) {
    return false;
  }

  const updated: StoredLink = {
    ...value,
    usedAt: Date.now(),
  };
  await redis.set(key, updated);
  return true;
}
