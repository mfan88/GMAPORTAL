/**
 * App/Upload Settings
 */
export type AppConfig = {
  folderName: string // Folder under the SharePoint site drive that receives uploads
  bufferTimeMs: number // How long after creation before a link becomes usable (ms)
  linkExpiryTimeMs: number
  fileDetails: {
    maxFileCount: number
    maxFileSizeBytes: number
    maxSimpleFileSizeBytes: number
    uploadChunkSizeBytes: number
  }
  acceptedUploadTypes: {
    readonly "video/*": readonly []
  }
  /** Excel workbook filename under the SharePoint site drive (e.g. REFERENCE.xlsx). */
  referenceSheetName: string
  /** Column header (or letter) with the child's name. */
  childNameColumn: string
  /** Column header (or letter) with the EDC date. */
  edcColumn: string
  /**
   * Microsoft account emails allowed to open /setup and manage the console.
   * Compared case-insensitively. Can also be seeded via ALLOWED_ADMIN_EMAILS.
   */
  allowedAdminEmails: string[]
  /** Graph site ID of the connected SharePoint site (e.g. "contoso.sharepoint.com,guid,guid"). */
  sharePointSiteId: string
  /** SharePoint site URL as entered/resolved at connect time (for display). */
  sharePointSiteUrl: string
  /** Display name of the connected SharePoint site (for display). */
  sharePointSiteName: string
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  folderName: "uploads",
  bufferTimeMs: 1000 * 60, // 60 seconds
  linkExpiryTimeMs: 1000 * 60 * 60, // 1 hour
  fileDetails: {
    maxFileCount: 1,
    maxFileSizeBytes: 4000 * 1024 * 1024, // 4 GB
    maxSimpleFileSizeBytes: 4 * 1024 * 1024, // 4 MB
    uploadChunkSizeBytes: 10 * 1024 * 1024, // 10 MB
  },
  acceptedUploadTypes: {
    "video/*": [],
  },
  referenceSheetName: "REFERENCE.xlsx",
  childNameColumn: "Child Name",
  edcColumn: "EDC",
  allowedAdminEmails: ["marcusfan06@outlook.com"],
  sharePointSiteId: "",
  sharePointSiteUrl: "",
  sharePointSiteName: "",
}


export const MAX_UPLOAD_BYTES = DEFAULT_APP_CONFIG.fileDetails.maxFileSizeBytes
export const MAX_SIMPLE_UPLOAD_BYTES =
  DEFAULT_APP_CONFIG.fileDetails.maxSimpleFileSizeBytes
export const UPLOAD_CHUNK_BYTES =
  DEFAULT_APP_CONFIG.fileDetails.uploadChunkSizeBytes
export const ACCEPTED_UPLOAD_TYPES = DEFAULT_APP_CONFIG.acceptedUploadTypes

export function formatMaxUploadSize(
  maxFileSizeBytes: number = MAX_UPLOAD_BYTES
) {
  const gb = maxFileSizeBytes / (1024 * 1024 * 1024)
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`
}

export function linkExpirySeconds(config: AppConfig) {
  return Math.max(1, Math.round(config.linkExpiryTimeMs / 1000))
}

export function bufferTimeSeconds(config: AppConfig) {
  return Math.max(0, Math.round(config.bufferTimeMs / 1000))
}

export type OneDriveUploadResult = {
  id: string
  name: string
  webUrl: string
  size: number
}

export type OneDriveUploadSession = {
  uploadUrl: string
  expirationDateTime: string
  uploadChunkSizeBytes?: number
}
