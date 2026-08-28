import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getOneDriveAccessToken, getSiteDriveBaseUrl } from "./auth";
import { driveBaseFromId } from "./graph";
import { getRedis } from "./redis";
import { publicUrl } from "./shape";

const FILE_REDIRECT_PREFIX = "file:";

type StoredFileRedirect = {
  itemId: string;
  driveId?: string;
};

function fileRedirectSlug(itemId: string, driveId?: string) {
  const material = driveId ? `${driveId}:${itemId}` : itemId;
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

export function isFileRedirectSlug(slug: string) {
  return /^[a-f0-9]{32}$/.test(slug);
}

type DriveItemLookup = {
  id?: string;
  name?: string;
  webUrl?: string;
  webDavUrl?: string;
  sharepointIds?: {
    listItemUniqueId?: string;
    siteUrl?: string;
  };
};

async function lookupDriveItem(itemId: string, driveId?: string) {
  const accessToken = await getOneDriveAccessToken();
  const base = driveId ? driveBaseFromId(driveId) : await getSiteDriveBaseUrl();
  const res = await fetch(
    `${base}/items/${encodeURIComponent(itemId)}?$select=id,name,webUrl,webDavUrl,sharepointIds`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const details = await res.text();
    throw new Error(
      `Could not look up uploaded file (${res.status}): ${
        details || res.statusText
      }`
    );
  }
  return (await res.json()) as DriveItemLookup;
}

/**
 * Office Stream (on SharePoint) player URL, not the raw file download/library link.
 */
function toStreamViewUrl(item: DriveItemLookup): string | null {
  const siteUrl = item.sharepointIds?.siteUrl?.replace(/\/+$/, "") ?? "";
  const uniqueId = item.sharepointIds?.listItemUniqueId?.trim() ?? "";

  if (siteUrl && uniqueId) {
    const stream = new URL(`${siteUrl}/_layouts/15/stream.aspx`);
    stream.searchParams.set("UniqueId", uniqueId);
    stream.searchParams.set("referrer", "StreamWebApp.Web");
    stream.searchParams.set("referrerScenario", "AddressBarCopied.view");
    return stream.toString();
  }

  const fileUrl = item.webDavUrl?.trim() || item.webUrl?.trim() || "";
  if (siteUrl && fileUrl) {
    try {
      const path = new URL(fileUrl).pathname;
      if (path && path !== "/") {
        const stream = new URL(`${siteUrl}/_layouts/15/stream.aspx`);
        stream.searchParams.set("id", path);
        stream.searchParams.set("referrer", "StreamWebApp.Web");
        stream.searchParams.set("referrerScenario", "AddressBarCopied.view");
        return stream.toString();
      }
    } catch {
      // Fall through to webUrl.
    }
  }

  const webUrl = item.webUrl?.trim() || "";
  if (webUrl.includes("/:v:/")) return webUrl;
  return webUrl || null;
}

/**
 * Persist an opaque slug for the Graph item and return a same-origin URL.
 * Does not change SharePoint permissions — visitors still open the Stream
 * player after the redirect.
 */
export async function createFileRedirectUrl(
  request: NextRequest,
  input: { itemId: string; driveId?: string }
): Promise<string> {
  const itemId = input.itemId.trim();
  if (!itemId) {
    throw new Error("A Graph item id is required to create a file redirect.");
  }
  const driveId = input.driveId?.trim() || undefined;
  const slug = fileRedirectSlug(itemId, driveId);
  const value: StoredFileRedirect = { itemId, ...(driveId ? { driveId } : {}) };
  await getRedis().set(`${FILE_REDIRECT_PREFIX}${slug}`, value);
  return publicUrl(`/v/${slug}`, request).toString();
}

/**
 * Current Stream player URL for a slug, or null if the mapping/file is gone.
 */
export async function resolveFileRedirectWebUrl(
  slug: string
): Promise<string | null> {
  if (!isFileRedirectSlug(slug)) return null;

  const key = `${FILE_REDIRECT_PREFIX}${slug}`;
  const stored = await getRedis().get<StoredFileRedirect>(key);
  if (!stored?.itemId) return null;

  const item = await lookupDriveItem(stored.itemId, stored.driveId);
  if (!item?.id) {
    await getRedis().del(key);
    return null;
  }

  const streamUrl = toStreamViewUrl(item);
  if (!streamUrl) {
    await getRedis().del(key);
    return null;
  }

  return streamUrl;
}
