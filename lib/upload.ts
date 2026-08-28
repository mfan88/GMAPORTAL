"use client";

import { useEffect, useState } from "react";
import {
  type OneDriveUploadResult,
  type OneDriveUploadSession,
  MAX_SIMPLE_UPLOAD_BYTES,
  UPLOAD_CHUNK_BYTES,
} from "@/lib/appConfig";
import { formatRecordedDateForApi } from "@/lib/uploadFilename";

// ---------------------------------------------------------------------------
// Live upload progress
// ---------------------------------------------------------------------------

let liveUploadPercent = 0;
const uploadPercentListeners = new Set<(percent: number) => void>();

export function getUploadPercent(
  bytesUploaded: number,
  totalBytes: number
): number {
  if (
    !Number.isFinite(bytesUploaded) ||
    !Number.isFinite(totalBytes) ||
    totalBytes <= 0
  ) {
    return 0;
  }

  const percent = Math.round((bytesUploaded / totalBytes) * 100);
  return Math.min(100, Math.max(0, percent));
}

export function getLiveUploadPercent(): number {
  return liveUploadPercent;
}

export function subscribeToLiveUploadPercent(
  listener: (percent: number) => void
): () => void {
  uploadPercentListeners.add(listener);
  listener(liveUploadPercent);
  return () => {
    uploadPercentListeners.delete(listener);
  };
}

function setLiveUploadPercent(percent: number) {
  liveUploadPercent = Math.min(100, Math.max(0, Math.round(percent)));
  for (const listener of uploadPercentListeners) {
    listener(liveUploadPercent);
  }
}

export function useLiveUploadPercent() {
  const [percent, setPercent] = useState(0);

  useEffect(() => subscribeToLiveUploadPercent(setPercent), []);

  return percent;
}

// ---------------------------------------------------------------------------
// Client → API upload flow
// ---------------------------------------------------------------------------

type UploadSessionResponse = OneDriveUploadSession;

async function uploadViaSession(
  file: File,
  uploadUrl: string,
  chunkSizeBytes: number = UPLOAD_CHUNK_BYTES
): Promise<OneDriveUploadResult> {
  let start = 0;

  while (start < file.size) {
    const end = Math.min(start + chunkSizeBytes, file.size) - 1;
    const chunk = file.slice(start, end + 1);

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.size),
        "Content-Range": `bytes ${start}-${end}/${file.size}`,
      },
      body: chunk,
    });

    if (response.status === 202) {
      start = end + 1;
      setLiveUploadPercent(getUploadPercent(start, file.size));
      continue;
    }

    if (response.status === 201 || response.status === 200) {
      setLiveUploadPercent(getUploadPercent(file.size, file.size));
      return (await response.json()) as OneDriveUploadResult;
    }

    const details = await response.text();
    throw new Error(
      `Upload failed (${response.status}): ${details || response.statusText}`
    );
  }

  throw new Error("Upload finished without receiving a file response.");
}

async function uploadViaApiRoute(
  file: File,
  dateRecorded: string
): Promise<OneDriveUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("dateRecorded", dateRecorded);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      setLiveUploadPercent(getUploadPercent(event.loaded, event.total));
    });

    xhr.addEventListener("load", () => {
      let payload: OneDriveUploadResult | { error?: string };
      try {
        payload = JSON.parse(xhr.responseText) as
          OneDriveUploadResult | { error?: string };
      } catch {
        reject(new Error("Upload failed"));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        setLiveUploadPercent(100);
        resolve(payload as OneDriveUploadResult);
        return;
      }

      reject(
        new Error(
          "error" in payload && payload.error ? payload.error : "Upload failed"
        )
      );
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.send(formData);
  });
}

/**
 * Notifies the server that an upload finished successfully so it can stamp the
 * workbook, move the child's row onto the done sheet, email the clinic, and
 * consume the single-use link. Best-effort: the file is already safely uploaded
 * at this point, so failures here are logged but not surfaced.
 */
async function finalizeUpload(result: OneDriveUploadResult): Promise<void> {
  try {
    await fetch("/api/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webUrl: result.webUrl,
        name: result.name,
        id: result.id,
        parentReference: result.parentReference,
      }),
    });
  } catch (error) {
    console.error("Failed to finalize upload:", error);
  }
}

async function getLiveUploadLimits() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) {
      return {
        maxSimpleFileSizeBytes: MAX_SIMPLE_UPLOAD_BYTES,
        uploadChunkSizeBytes: UPLOAD_CHUNK_BYTES,
      };
    }
    const config = (await response.json()) as {
      fileDetails?: {
        maxSimpleFileSizeBytes?: number;
        uploadChunkSizeBytes?: number;
      };
    };
    return {
      maxSimpleFileSizeBytes:
        config.fileDetails?.maxSimpleFileSizeBytes ?? MAX_SIMPLE_UPLOAD_BYTES,
      uploadChunkSizeBytes:
        config.fileDetails?.uploadChunkSizeBytes ?? UPLOAD_CHUNK_BYTES,
    };
  } catch {
    return {
      maxSimpleFileSizeBytes: MAX_SIMPLE_UPLOAD_BYTES,
      uploadChunkSizeBytes: UPLOAD_CHUNK_BYTES,
    };
  }
}

export async function uploadFileToOneDrive(
  file: File,
  dateTaken: Date
): Promise<OneDriveUploadResult> {
  setLiveUploadPercent(0);
  const dateRecorded = formatRecordedDateForApi(dateTaken);
  const limits = await getLiveUploadLimits();

  try {
    let result: OneDriveUploadResult;

    if (file.size <= limits.maxSimpleFileSizeBytes) {
      result = await uploadViaApiRoute(file, dateRecorded);
    } else {
      const sessionResponse = await fetch("/api/upload/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          dateRecorded,
        }),
      });

      const sessionPayload = (await sessionResponse.json()) as
        UploadSessionResponse | { error?: string };

      if (!sessionResponse.ok) {
        throw new Error(
          "error" in sessionPayload && sessionPayload.error
            ? sessionPayload.error
            : "Could not start upload session"
        );
      }

      const session = sessionPayload as UploadSessionResponse;
      result = await uploadViaSession(
        file,
        session.uploadUrl,
        session.uploadChunkSizeBytes ?? limits.uploadChunkSizeBytes
      );
    }

    await finalizeUpload(result);
    return result;
  } catch (error) {
    setLiveUploadPercent(0);
    throw error;
  }
}
