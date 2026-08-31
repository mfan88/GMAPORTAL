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
  webUrl?: string;
  sharepointIds?: {
    listItemUniqueId?: string;
    siteUrl?: string;
  };
};

type DriveItemPreview = {
  getUrl?: string;
};

async function itemBase(itemId: string, driveId?: string) {
  const accessToken = await getOneDriveAccessToken();
  const base = driveId ? driveBaseFromId(driveId) : await getSiteDriveBaseUrl();
  return { accessToken, base, itemId };
}

async function lookupDriveItem(itemId: string, driveId?: string) {
  const { accessToken, base } = await itemBase(itemId, driveId);
  const res = await fetch(
    `${base}/items/${encodeURIComponent(itemId)}?$select=id,webUrl,sharepointIds`,
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

/** SharePoint/OneDrive Preview (not the inline HTML5 video player). */
async function lookupDriveItemPreviewUrl(itemId: string, driveId?: string) {
  const { accessToken, base } = await itemBase(itemId, driveId);
  const res = await fetch(
    `${base}/items/${encodeURIComponent(itemId)}/preview`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  const preview = (await res.json()) as DriveItemPreview;
  return preview.getUrl?.trim() || null;
}

function sharePointEmbedPreviewUrl(item: DriveItemLookup) {
  const uniqueId = item.sharepointIds?.listItemUniqueId?.trim();
  const siteUrl = item.sharepointIds?.siteUrl?.replace(/\/+$/, "");
  if (!uniqueId || !siteUrl) return null;
  const id = uniqueId.replace(/^\{|\}$/g, "");
  return `${siteUrl}/_layouts/15/embed.aspx?UniqueId=${encodeURIComponent(id)}`;
}

/**
 * Persist an opaque slug for the Graph item and return a same-origin URL.
 * Recipients still need existing org access. The slug opens Preview when
 * Graph or SharePoint can provide it; otherwise it falls back to webUrl.
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
 * Preview URL for a slug, or null if the mapping/file is gone.
 * Preview is generated on each click so the Graph getUrl stays fresh.
 */
export async function resolveFileRedirectWebUrl(
  slug: string
): Promise<string | null> {
  if (!isFileRedirectSlug(slug)) return null;

  const key = `${FILE_REDIRECT_PREFIX}${slug}`;
  const stored = await getRedis().get<StoredFileRedirect>(key);
  if (!stored?.itemId) return null;

  const item = await lookupDriveItem(stored.itemId, stored.driveId);
  const webUrl = item?.webUrl?.trim() || "";
  if (!item?.id || !webUrl) {
    await getRedis().del(key);
    return null;
  }

  const previewUrl = await lookupDriveItemPreviewUrl(
    stored.itemId,
    stored.driveId
  );
  if (previewUrl) return previewUrl;

  return sharePointEmbedPreviewUrl(item) ?? webUrl;
}
