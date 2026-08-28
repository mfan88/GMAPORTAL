import { weeksFromEdcToDate } from "../age"
import type { OneDriveUploadResult, OneDriveUploadSession } from "../appConfig"
import { parseRecordedDate, buildUploadFilename } from "../uploadFilename"
import { resolveUploadLocation } from "./auth"
import { getAppConfig } from "./configHelper"
import { getPortalAccessTokenFromRequest } from "./cookies"
import { encodeDrivePath, parseGraphError } from "./graph"
import { getUploadLink } from "./redis"
  
  export async function buildDriveItemPath(filename: string) {
    const location = await resolveUploadLocation(filename)
    return location.itemPath
  }
  
  export function sanitizeUploadFilename(filename: string) {
    const base = filename.split(/[/\\]/).pop()?.trim()
    if (!base) {
      throw new Error("A valid filename is required.")
    }
    return base
  }
  
  /**
   * Build the OneDrive filename from the portal link's child name + EDC and the
   * parent-selected date recorded. Age is weeks from EDC → date recorded.
   */
  export async function resolvePortalUploadFilename(
    req: { headers: { cookie?: string } },
    dateRecordedRaw: string,
    originalFilename: string
  ): Promise<string> {
    const token = getPortalAccessTokenFromRequest(req)
    if (!token) {
      throw new Error(
        "A parent upload link is required before a file can be named and uploaded."
      )
    }
  
    const link = await getUploadLink(token)
    if (!link || link.state === "used") {
      throw new Error("This upload link is no longer valid.")
    }
    if (!link.childName) {
      throw new Error("This upload link is missing a child name.")
    }
    if (!link.edc) {
      throw new Error(
        "This upload link is missing an EDC date. Ask the clinic for a new link."
      )
    }
  
    const dateRecorded = parseRecordedDate(dateRecordedRaw)
    if (!dateRecorded) {
      throw new Error("A valid date recorded is required.")
    }
  
    const ageWeeks = weeksFromEdcToDate(link.edc, dateRecorded)
    if (ageWeeks === null) {
      throw new Error("Could not calculate age from EDC and the date recorded.")
    }
  
    return buildUploadFilename(
      sanitizeUploadFilename(originalFilename),
      dateRecorded,
      link.childName,
      ageWeeks
    )
  }
  
  export async function assertValidUploadSize(fileSize: number) {
    const {
      fileDetails: { maxFileSizeBytes },
    } = await getAppConfig()
  
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new Error("File size is required.")
    }
    if (fileSize > maxFileSizeBytes) {
      throw new Error(
        `Files must be ${maxFileSizeBytes / (1024 * 1024)} MB or smaller.`
      )
    }
  }
  
  export async function uploadSmallFileToOneDrive(
    file: File,
    accessToken: string
  ): Promise<OneDriveUploadResult> {
    const {
      fileDetails: { maxSimpleFileSizeBytes },
    } = await getAppConfig()
  
    if (file.size > maxSimpleFileSizeBytes) {
      throw new Error(
        `Use a resumable upload session for files over ${maxSimpleFileSizeBytes / (1024 * 1024)} MB.`
      )
    }
  
    const { driveBase, itemPath } = await resolveUploadLocation(file.name)
    const encodedPath = encodeDrivePath(itemPath)
    const res = await fetch(
      `${driveBase}/root:/${encodedPath}:/content`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      }
    )
  
    if (!res.ok) {
      await parseGraphError(res)
    }
  
    const item = (await res.json()) as OneDriveUploadResult
    if (!item.webUrl) {
      throw new Error("Upload succeeded but OneDrive did not return a file URL.")
    }
  
    return item
  }
  
  export async function createOneDriveUploadSession(
    accessToken: string,
    filename: string
  ): Promise<OneDriveUploadSession> {
    const { driveBase, itemPath } = await resolveUploadLocation(filename)
    const encodedPath = encodeDrivePath(itemPath)
    const res = await fetch(
      `${driveBase}/root:/${encodedPath}:/createUploadSession`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: {
            "@microsoft.graph.conflictBehavior": "rename",
            name: filename,
          },
        }),
      }
    )
  
    if (!res.ok) {
      await parseGraphError(res)
    }
  
    const session = (await res.json()) as OneDriveUploadSession
    if (!session.uploadUrl) {
      throw new Error("OneDrive did not return an upload session URL.")
    }
  
    return session
  }