"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import type { OneDriveUploadResult } from "@/lib/appConfig";

export interface UploadFile {
  file: File;
  previewUrl: string;
}

export type UploadWindow = {
  availableAt: number;
  expiresAt: number;
};

export interface FileProviderContextType {
  files: UploadFile | null;
  setFiles: Dispatch<SetStateAction<UploadFile | null>>;
  uploadError: string | null;
  setUploadError: Dispatch<SetStateAction<string | null>>;
  uploadResult: OneDriveUploadResult | null;
  setUploadResult: Dispatch<SetStateAction<OneDriveUploadResult | null>>;
  date: Date | undefined;
  setDate: Dispatch<SetStateAction<Date | undefined>>;
  isUploading: boolean;
  setIsUploading: Dispatch<SetStateAction<boolean>>;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  /** ISO EDC from the portal link; age is derived from this + date recorded. */
  edc: string | null;
  setEdc: Dispatch<SetStateAction<string | null>>;
  /** Parent upload window from the portal link, when present. */
  uploadWindow: UploadWindow | null;
  linkContextReady: boolean;
  hasFileSelected: boolean;
}

export const FileProviderContext = createContext<
  FileProviderContextType | undefined
>(undefined);

export function useFileProviderContext() {
  const context = useContext(FileProviderContext);
  if (!context) {
    throw new Error(
      "useFileProviderContext must be used within a FileProvider"
    );
  }
  return context;
}

export function FileProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [files, setFiles] = useState<UploadFile | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<OneDriveUploadResult | null>(
    null
  );
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const [name, setName] = useState("");
  const [edc, setEdc] = useState<string | null>(null);
  const [uploadWindow, setUploadWindow] = useState<UploadWindow | null>(null);
  const [linkContextReady, setLinkContextReady] = useState(false);
  const hasFileSelected = files !== null;

  // Refetch whenever the upload page is shown. Root layout keeps this provider
  // mounted across /link-expired → /portalaccess → /, so a mount-only fetch
  // would miss the portal cookie set after the countdown.
  useEffect(() => {
    if (pathname !== "/") {
      return;
    }

    let cancelled = false;
    setLinkContextReady(false);

    void fetch("/api/upload/context")
      .then(async (res) => {
        const data = (await res.json()) as {
          childName?: string | null;
          edc?: string | null;
          availableAt?: number | null;
          expiresAt?: number | null;
          error?: string;
        };
        if (!res.ok || cancelled) return;
        if (typeof data.childName === "string" && data.childName.trim()) {
          setName(data.childName.trim());
        }
        if (typeof data.edc === "string" && data.edc.trim()) {
          setEdc(data.edc.trim());
        }
        if (
          typeof data.availableAt === "number" &&
          Number.isFinite(data.availableAt) &&
          typeof data.expiresAt === "number" &&
          Number.isFinite(data.expiresAt)
        ) {
          setUploadWindow({
            availableAt: data.availableAt,
            expiresAt: data.expiresAt,
          });
        }
      })
      .catch(() => {
        // Parents without a bound link (or admins testing) simply won't have
        // name/EDC prefilled — upload stays disabled until both exist.
      })
      .finally(() => {
        if (!cancelled) setLinkContextReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

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
        edc,
        setEdc,
        uploadWindow,
        linkContextReady,
        hasFileSelected,
      }}
    >
      {children}
    </FileProviderContext.Provider>
  );
}
