"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import type { OneDriveUploadResult } from "@/lib/appConfig"

export interface UploadFile {
  file: File
  previewUrl: string
}

export interface FileProviderContextType {
  files: UploadFile | null
  setFiles: Dispatch<SetStateAction<UploadFile | null>>
  uploadError: string | null
  setUploadError: Dispatch<SetStateAction<string | null>>
  uploadResult: OneDriveUploadResult | null
  setUploadResult: Dispatch<SetStateAction<OneDriveUploadResult | null>>
  date: Date | undefined
  setDate: Dispatch<SetStateAction<Date | undefined>>
  isUploading: boolean
  setIsUploading: Dispatch<SetStateAction<boolean>>
  name: string
  setName: Dispatch<SetStateAction<string>>
  ageWeeks: number | null
  setAgeWeeks: Dispatch<SetStateAction<number | null>>
  linkContextReady: boolean
  hasFileSelected: boolean
}

export const FileProviderContext = createContext<
  FileProviderContextType | undefined
>(undefined)

export function useFileProviderContext() {
  const context = useContext(FileProviderContext)
  if (!context) {
    throw new Error(
      "useFileProviderContext must be used within a FileProvider"
    )
  }
  return context
}

export function FileProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<UploadFile | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] =
    useState<OneDriveUploadResult | null>(null)
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [isUploading, setIsUploading] = useState(false)
  const [name, setName] = useState("")
  const [ageWeeks, setAgeWeeks] = useState<number | null>(null)
  const [linkContextReady, setLinkContextReady] = useState(false)
  const hasFileSelected = files !== null

  useEffect(() => {
    let cancelled = false

    void fetch("/api/upload/context")
      .then(async (res) => {
        const data = (await res.json()) as {
          childName?: string | null
          ageWeeks?: number | null
          error?: string
        }
        if (!res.ok || cancelled) return
        if (typeof data.childName === "string" && data.childName.trim()) {
          setName(data.childName.trim())
        }
        if (typeof data.ageWeeks === "number" && Number.isFinite(data.ageWeeks)) {
          setAgeWeeks(Math.max(0, Math.floor(data.ageWeeks)))
        }
      })
      .catch(() => {
        // Parents without a bound link (or admins testing) simply won't have
        // name/age prefilled — upload stays disabled until both exist.
      })
      .finally(() => {
        if (!cancelled) setLinkContextReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <FileProviderContext.Provider
      value={{
        files,
        setFiles,
        uploadError,
        setUploadError,
        uploadResult,
        setUploadResult,
        date,
        setDate,
        isUploading,
        setIsUploading,
        name,
        setName,
        ageWeeks,
        setAgeWeeks,
        linkContextReady,
        hasFileSelected,
      }}
    >
      {children}
    </FileProviderContext.Provider>
  )
}
