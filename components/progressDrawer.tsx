"use client";

import { useEffect, useState } from "react";
import { useFileProviderContext } from "@/app/fileprovider";
import { useLiveUploadPercent } from "@/lib/upload";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";

export default function ProgressDrawer() {
  const { isUploading, uploadResult } = useFileProviderContext();
  const percent = useLiveUploadPercent();
  const [wasUploading, setWasUploading] = useState(isUploading);
  const [holdOpen, setHoldOpen] = useState(false);

  if (isUploading !== wasUploading) {
    setWasUploading(isUploading);
    if (isUploading) {
      setHoldOpen(true);
    } else if (!uploadResult) {
      setHoldOpen(false);
    }
  }

  const finishedOk = Boolean(uploadResult) && !isUploading;
  const open = isUploading || (holdOpen && finishedOk);
  const shownPercent = finishedOk ? 100 : percent;
  const stillFinishing = isUploading && shownPercent >= 100;
  const statusLabel = finishedOk
    ? "100% complete"
    : stillFinishing
      ? "Almost Done..."
      : `${shownPercent}% complete`;

  useEffect(() => {
    if (!holdOpen || isUploading || !uploadResult) return;

    const timer = window.setTimeout(() => {
      setHoldOpen(false);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [holdOpen, isUploading, uploadResult]);

  useEffect(() => {
    if (!isUploading) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isUploading]);

  return (
    <Drawer
      open={open}
      disablePointerDismissal={isUploading}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isUploading) return;
        if (!nextOpen) setHoldOpen(false);
      }}
    >
      <DrawerContent className="min-h-[42vh] bg-white text-[#02182B] sm:min-h-[28vh] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-[#02182B]/20 sm:hidden" />
        <DrawerHeader className="px-5 text-left sm:px-6">
          <DrawerTitle className="font-heading text-xl font-semibold sm:text-lg">
            {finishedOk
              ? "Upload Complete!"
              : "Thanks for starting an upload!"}
          </DrawerTitle>
          <DrawerDescription className="text-base text-[#02182B]/75">
            {finishedOk
              ? "You can now close the tab safely. Thank you."
              : "Please keep this window open until the upload is complete"}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-5 pt-5 pb-6 sm:px-6">
          <progress
            className="h-7 w-full overflow-hidden rounded-full bg-[#02182B]/15 sm:h-6 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[#02182B] [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-[#02182B]/15 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[#02182B]"
            max={100}
            value={shownPercent}
            aria-label="Upload progress"
          />
          <p className="text-center text-base font-medium tabular-nums sm:text-sm">
            {statusLabel}
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
