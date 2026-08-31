"use client";

import { InfoGroup, MobileInfoGroup } from "@/components/infoGroup";
import { UploadArea, MobileUploadArea } from "@/components/uploadArea";
import ProgressDrawer from "@/components/progressDrawer";
import { useFileProviderContext } from "@/app/fileprovider";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

function formatWindowTime(ms: number) {
  return format(new Date(ms), "MMM d, yyyy 'at' h:mm a");
}

function InstructionsText() {
  const { uploadWindow, linkContextReady } = useFileProviderContext();

  if (linkContextReady && uploadWindow) {
    return `Please upload a video between ${formatWindowTime(uploadWindow.availableAt)} and ${formatWindowTime(uploadWindow.expiresAt)}, and fill out the information below.\n\nThank you for sharing this video. It will only be watched for assessment purposes, by physiotherapists certified in this type of assessment.`;
  }

  return "Please upload a video within the time window on your clinic link, and fill out the information below.\n\nThank you for sharing this video. It will only be watched for assessment purposes, by physiotherapists certified in this type of assessment.";
}

export default function ParentUploadView() {
  return (
    <div className="min-h-dvh max-w-dvw bg-white text-black">
      <header className="box-border flex h-[10dvh] max-h-[10dvh] shrink-0 items-center justify-between overflow-hidden px-4 py-2">
        <Image
          className="h-full max-h-full w-auto object-contain"
          src="/images/dda-logo.svg"
          alt="Developmental Disabilities Association"
          width={1338}
          height={472}
          priority
        />
      </header>

      <div className="flex hidden h-auto w-full flex-col gap-5 bg-white p-6 text-black select-none sm:block">
        <section className="h-4em box-border flex justify-center p-15">
          <h1 className="text-center font-medium text-black md:text-xl lg:text-4xl">
            General Movements Assessment (GMA) Video Portal for the Vancouver
            Infant Development Program
          </h1>
        </section>
        <section className="flex w-full flex-row gap-0">
          <div className="relative flex w-[50%] flex-shrink-0 flex-row items-center justify-center">
            <UploadArea className="flex h-[50%] w-full flex-shrink-0" />
            <Separator
              orientation="vertical"
              className="absolute right-0 h-full rounded-sm bg-black/50 p-0.25"
            />
          </div>
          <div className="box-border flex w-full flex-col px-20">
            <div className="flex flex-col gap-5">
              <section>
                <span className="text-xl font-medium">Instructions</span>
                <Separator
                  orientation="horizontal"
                  className="rounded p-0.25"
                />
              </section>
              <span className="text-md whitespace-pre-line">
                <InstructionsText />
              </span>
              <InfoGroup />
            </div>
          </div>
        </section>
      </div>

      <div className="h-auto w-dvw bg-white pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:hidden">
        <section className="box-border flex h-auto justify-center p-10">
          <h1 className="text-center font-medium text-black">
            General Movements Assessment (GMA) Video Portal for the Vancouver
            Infant Development Program
          </h1>
        </section>
        <section className="flex h-auto w-full flex-col gap-1 px-10">
          <h2 className="font-medium">Instructions</h2>
          <span className="text-md whitespace-pre-line">
            <InstructionsText />
          </span>
        </section>
        <section className="mt-5 box-border w-full px-10">
          <MobileInfoGroup />
        </section>
        <section className="mt-5 box-border w-full px-10">
          <MobileUploadArea />
        </section>
      </div>
      <ProgressDrawer />
    </div>
  );
}
