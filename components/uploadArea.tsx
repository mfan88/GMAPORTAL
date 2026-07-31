"use client"

import { cn } from "@/lib/utils"
import { useFileProviderContext } from "@/app/fileprovider"
import { uploadFileToOneDrive } from "@/lib/upload"
import {
  ACCEPTED_UPLOAD_TYPES,
  DEFAULT_APP_CONFIG,
  MAX_UPLOAD_BYTES,
  formatMaxUploadSize,
} from "@/lib/appConfig"
import { Button } from "@/components/ui/button"
import { useCallback, type ChangeEvent } from "react"
import { useDropzone } from "react-dropzone"
import FileDisplay from "./fileDisplay"

export { UploadArea, MobileUploadArea }

interface UploadAreaProps {
  className?: string
}

function isLikelyVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true
  if (file.type.startsWith("image/") || file.type.startsWith("audio/")) {
    return false
  }
  // iOS Photos / Camera often returns an empty MIME type for .mov/.mp4.
  if (/\.(mp4|m4v|mov|qt|webm|avi|mkv|3gp)$/i.test(file.name)) {
    return true
  }
  // Camera roll picks can omit both MIME and a usable filename.
  return !file.type && file.size > 0
}

/**
 * Safari/iOS can invalidate the File from <input> after the change handler
 * returns (especially if value is cleared). Snapshot into a new File first.
 */
function snapshotFile(file: File): File {
  const name = file.name?.trim()
    ? file.name
    : `video-${Date.now()}.mov`
  const type = file.type || "video/quicktime"
  return new File([file], name, {
    type,
    lastModified: file.lastModified || Date.now(),
  })
}

function useUploadActions() {
  const {
    files,
    setFiles,
    setUploadError,
    setUploadResult,
    date,
    isUploading,
    setIsUploading,
    uploadError,
    uploadResult,
    name,
    edc,
    hasFileSelected,
  } = useFileProviderContext()

  const runUpload = useCallback(
    async (file: File, dateTaken: Date) => {
      setUploadError(null)
      setUploadResult(null)
      setIsUploading(true)

      try {
        const result = await uploadFileToOneDrive(file, dateTaken)
        setUploadResult(result)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed"
        setUploadError(message)
        console.error("OneDrive upload failed:", error)
      } finally {
        setIsUploading(false)
      }
    },
    [setIsUploading, setUploadError, setUploadResult]
  )

  const registerSelectedFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return false

      if (!isLikelyVideoFile(file)) {
        setUploadError("Only video files are supported.")
        return false
      }
      if (file.size <= 0) {
        setUploadError(
          "Could not read that video. If it is in iCloud, download it on this phone and try again."
        )
        return false
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadError(`Files must be ${formatMaxUploadSize()} or smaller.`)
        return false
      }

      setUploadError(null)
      setUploadResult(null)
      setFiles({
        file,
        previewUrl: URL.createObjectURL(file),
      })
      return true
    },
    [setFiles, setUploadError, setUploadResult]
  )

  const canUpload =
    Boolean(files?.file) &&
    Boolean(date) &&
    Boolean(name.trim()) &&
    Boolean(edc)

  return {
    files,
    date,
    isUploading,
    uploadError,
    uploadResult,
    hasFileSelected,
    canUpload,
    runUpload,
    registerSelectedFile,
    setUploadError,
  }
}

function UploadArea({
  className,
  ...props
}: Readonly<UploadAreaProps>) {
  const {
    files,
    date,
    isUploading,
    uploadResult,
    hasFileSelected,
    canUpload,
    runUpload,
    registerSelectedFile,
    setUploadError,
  } = useUploadActions()

  const { getRootProps, getInputProps } = useDropzone({
    accept: ACCEPTED_UPLOAD_TYPES,
    multiple: false,
    maxFiles: DEFAULT_APP_CONFIG.fileDetails.maxFileCount,
    maxSize: MAX_UPLOAD_BYTES,
    useFsAccessApi: false,
    disabled: hasFileSelected,
    onDrop: (acceptedFile) => {
      registerSelectedFile(acceptedFile[0])
    },
    onDropRejected: (rejections) => {
      const rejection = rejections[0]
      const tooLarge = rejection?.errors.some(
        (error) => error.code === "file-too-large"
      )
      setUploadError(
        tooLarge
          ? `Files must be ${formatMaxUploadSize()} or smaller.`
          : "Only video files are supported."
      )
    },
  })

  const dropzoneProps = hasFileSelected ? {} : getRootProps()

  return (
    <div className="flex w-[80%] flex-col items-center gap-2">
      <div
        {...dropzoneProps}
        className={cn(
          "box-border flex flex-col items-center justify-center self-stretch rounded-xl px-20 py-32",
          hasFileSelected
            ? "border border-transparent"
            : "cursor-pointer border border-dashed border-black/90",
          className
        )}
        {...props}
      >
        {hasFileSelected ? (
          <div className="flex w-full items-center justify-center px-4">
            <FileDisplay className="w-full max-w-full gap-0" file={files} />
          </div>
        ) : (
          <>
            <input {...getInputProps()} />
            <span>Drop or click here to add a video</span>
            <span className="text-sm text-muted-foreground">
              Please only select one video
            </span>
          </>
        )}
      </div>

      {hasFileSelected && !isUploading && !uploadResult ? (
        <Button
          className={`w-[65%] ${canUpload ? "bg-blue" : "bg-none"}`}
          variant="outline"
          disabled={!canUpload}
          onClick={() => {
            if (!files?.file || !date) return
            void runUpload(files.file, date)
          }}
        >
          Upload
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Safari / iOS: a full-size transparent <input type="file"> over the control
 * receives the tap. Do not use react-dropzone open(), programmatic click(),
 * display:none / sr-only inputs, or clear input.value in the same turn as
 * reading files.
 */
function MobileUploadArea({
  className,
}: Readonly<{ className?: string }>) {
  const {
    files,
    date,
    isUploading,
    uploadError,
    uploadResult,
    hasFileSelected,
    canUpload,
    runUpload,
    registerSelectedFile,
  } = useUploadActions()

  const onMobileFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const picked = input.files?.item(0)
    if (!picked) return

    const file = snapshotFile(picked)
    registerSelectedFile(file)

    // Clear later so the same asset can be re-picked — never in the same turn
    // as reading the File (iOS Safari can drop the reference).
    window.setTimeout(() => {
      try {
        input.value = ""
      } catch {
        // ignore
      }
    }, 0)
  }

  return (
    <div className={cn("mt-4 flex w-full flex-col items-center gap-3", className)}>
      {hasFileSelected ? (
        <FileDisplay className="w-full max-w-full gap-0" file={files} />
      ) : (
        <div className="relative w-full touch-manipulation">
          <div
            className={cn(
              "flex w-full items-center justify-center rounded-md border border-border bg-mobile-button px-2.5 py-8 text-base font-medium text-black shadow-xs",
              isUploading && "opacity-50"
            )}
            aria-hidden
          >
            Add video
          </div>
          <input
            type="file"
            accept="video/*,video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v"
            // No capture — lets iOS offer Photo Library / Take Video / Files.
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:pointer-events-none"
            disabled={isUploading}
            onChange={onMobileFileChange}
            aria-label="Add video"
          />
        </div>
      )}

      {uploadError ? (
        <p className="w-full text-center text-sm text-red-600">{uploadError}</p>
      ) : null}

      {hasFileSelected && !isUploading && !uploadResult ? (
        <>
          <Button
            className={`w-full touch-manipulation ${canUpload ? "bg-blue" : "bg-none"}`}
            variant="outline"
            disabled={!canUpload}
            onClick={() => {
              if (!files?.file || !date) return
              void runUpload(files.file, date)
            }}
          >
            Upload
          </Button>
          {!canUpload ? (
            <p className="w-full text-center text-sm text-muted-foreground">
              {!date
                ? "Pick the date recorded above to enable upload."
                : "Open this page from your clinic link so child details can load."}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
