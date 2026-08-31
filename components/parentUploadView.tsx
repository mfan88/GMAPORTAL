"use client";

import { InfoGroup, MobileInfoGroup } from "@/components/infoGroup";
import { UploadArea, MobileUploadArea } from "@/components/uploadArea";
import ProgressDrawer from "@/components/progressDrawer";
import { useFileProviderContext } from "@/app/fileprovider";
import Image from "next/image";
import { format } from "date-fns";

function formatWindowTime(ms: number) {
  return format(new Date(ms), "MMM d, yyyy 'at' h:mm a");
}

function Instructions() {
  const { uploadWindow, linkContextReady } = useFileProviderContext();

  const windowLine =
    linkContextReady && uploadWindow
      ? `Please upload a video between ${formatWindowTime(uploadWindow.availableAt)} and ${formatWindowTime(uploadWindow.expiresAt)}.`
      : "Please upload a video within the time window on your clinic link.";

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-xl font-semibold">Instructions</h2>
      <p className="leading-relaxed text-[#02182B]/80">{windowLine}</p>
      <p className="leading-relaxed text-[#02182B]/80">
        Fill out the date the video was recorded, then add one video. Thank you
        for sharing this recording. It will only be watched for assessment
        purposes, by physiotherapists certified in this type of assessment.
      </p>
    </div>
  );
}

export default function ParentUploadView() {
  return (
    <div className="dda-brand min-h-dvh bg-white text-[#02182B]">
      <header className="border-b border-[#02182B]/10">
        <div className="mx-auto flex w-full max-w-5xl items-center px-4 py-4 sm:px-6">
          <div className="block h-10 sm:h-12 lg:h-14">
            <Image
              className="h-full w-auto"
              src="/images/dda-logo.svg"
              alt="Developmental Disabilities Association"
              width={1338}
              height={472}
              priority
            />
          </div>
        </div>
      </header>
      <div className="h-1 bg-[#E98300]" />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-sm font-semibold tracking-[0.16em] text-[#E98300] uppercase">
          Vancouver Infant Development Program
        </p>
        <h1 className="font-heading mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          General Movement Assessment Video Upload
        </h1>

        <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
          <section className="rounded-sm border border-[#02182B]/15 p-5 sm:p-6">
            <Instructions />
            <div className="mt-6 hidden sm:block">
              <InfoGroup />
            </div>
            <div className="mt-6 sm:hidden">
              <MobileInfoGroup />
            </div>
          </section>

          <section className="rounded-sm border border-[#02182B]/15 p-5 sm:p-6">
            <h2 className="font-heading mb-4 text-xl font-semibold">
              Your video
            </h2>
            <div className="hidden sm:block">
              <UploadArea className="w-full" />
            </div>
            <div className="sm:hidden">
              <MobileUploadArea />
            </div>
          </section>
        </div>
      </main>
      <ProgressDrawer />
    </div>
  );
}
