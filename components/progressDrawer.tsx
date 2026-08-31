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
      <DrawerContent className="min-h-[28vh] bg-white text-[#02182B]">
        <DrawerHeader>
          <DrawerTitle className="text-lg font-semibold">
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
        <div className="flex flex-col gap-3 px-4 pt-6 pb-8">
          <progress
            className="h-6 w-full overflow-hidden rounded-full bg-[#02182B]/15 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[#02182B] [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-[#02182B]/15 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[#02182B] [&::-webkit-progress-value]:transition-[width]"
            max={100}
            value={shownPercent}
            aria-label="Upload progress"
          />
          <p className="text-center text-sm font-medium tabular-nums">
            {shownPercent}% complete
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
