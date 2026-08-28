import fs from "node:fs"
import path from "node:path"
import { del, get, put } from "@vercel/blob"

const BLOB_PATHNAME = "onedrive/token-cache.json"

export function usesBlobTokenStore() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)
}

export function getBlobAuthMode(): "oidc" | "token" | "none" {
  if (process.env.BLOB_STORE_ID) return "oidc"
  if (process.env.BLOB_READ_WRITE_TOKEN) return "token"
  return "none"
}

export function getFileTokenCachePath() {
  if (process.env.ONEDRIVE_CACHE_PATH) {
    return process.env.ONEDRIVE_CACHE_PATH
  }

  if (process.env.VERCEL) {
    return "/tmp/onedrive-cache.json"
  }

  return path.join(process.cwd(), ".data", "onedrive-cache.json")
}

export async function readTokenCache(): Promise<string | null> {
  if (usesBlobTokenStore()) {
    try {
      const result = await get(BLOB_PATHNAME, { access: "private" })
      if (result?.statusCode !== 200 || !result.stream) {
        return null
      }
      return await new Response(result.stream).text()
    } catch {
      return null
    }
  }

  const filePath = getFileTokenCachePath()
  if (!fs.existsSync(filePath)) {
    return null
  }

  return fs.readFileSync(filePath, "utf8")
}

export async function writeTokenCache(serialized: string) {
  if (usesBlobTokenStore()) {
    await put(BLOB_PATHNAME, serialized, {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
    })
    return
  }

  if (process.env.VERCEL && !usesBlobTokenStore()) {
    throw new Error(
      "OneDrive tokens cannot be saved on Vercel without Blob storage. In the Vercel dashboard, create a Blob store for this project, redeploy, then connect again."
    )
  }

  const filePath = getFileTokenCachePath()
  const directory = path.dirname(filePath)
  if (directory !== "/tmp" && !fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
  fs.writeFileSync(filePath, serialized, "utf8")
}

export async function deleteTokenCache() {
  if (usesBlobTokenStore()) {
    try {
      await del(BLOB_PATHNAME)
    } catch {
      // Blob may not exist yet.
    }
    return
  }

  const filePath = getFileTokenCachePath()
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export function getTokenStorageDescription() {
  const authMode = getBlobAuthMode()
  if (authMode === "oidc") {
    return "Vercel Blob (OIDC)"
  }
  if (authMode === "token") {
    return "Vercel Blob"
  }
  if (process.env.VERCEL) {
    return "unconfigured (connect Blob store to this project and redeploy)"
  }
  return "local file"
}