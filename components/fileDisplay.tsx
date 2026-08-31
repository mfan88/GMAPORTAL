"use client";

import { UploadFile, useFileProviderContext } from "@/app/fileprovider";
import { cn } from "@/lib/utils";
import { CircleCheck, FileText, Trash2Icon, TriangleAlert } from "lucide-react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";

interface FileDisplayProps {
  className?: string;
  file: UploadFile | null;
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "Parse error";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function FileDisplay({
  className,
  file,
}: Readonly<FileDisplayProps>) {
  const {
    setFiles,
    setUploadError,
    setUploadResult,
    isUploading,
    uploadError,
    uploadResult,
  } = useFileProviderContext();

  const removeFile = () => {
    if (isUploading) return;
    setFiles(null);
    setUploadError(null);
    setUploadResult(null);
  };

  const fileName = file?.file.name ?? "File Upload Error";

  const state = !file
    ? "error"
    : isUploading
      ? "uploading"
      : uploadError
        ? "error"
        : uploadResult
          ? "done"
          : "idle";

  const description = !file
    ? "Please remove the file and try again"
    : isUploading
      ? "Uploading — please keep this page open"
      : uploadError
        ? uploadError
        : uploadResult
          ? "Upload complete — thank you for sharing"
          : formatFileSize(file.file.size);

  return (
    <Attachment
      size="default"
      state={state}
      className={cn("min-w-0 flex-nowrap overflow-hidden", className)}
    >
      <AttachmentMedia>
        {uploadResult ? (
          <CircleCheck className="text-green-600" />
        ) : uploadError || !file ? (
          <TriangleAlert />
        ) : (
          <FileText />
        )}
      </AttachmentMedia>
      <AttachmentContent className="ml-2 min-w-0 overflow-hidden">
        <AttachmentTitle title={fileName}>{fileName}</AttachmentTitle>
        <AttachmentDescription>{description}</AttachmentDescription>
      </AttachmentContent>
      {!isUploading && !uploadResult ? (
        <AttachmentActions className="shrink-0">
          <AttachmentAction
            onClick={removeFile}
            aria-label={`Remove ${fileName}`}
          >
            <Trash2Icon />
          </AttachmentAction>
        </AttachmentActions>
      ) : null}
    </Attachment>
  );
}
