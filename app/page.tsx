"use client"
import InfoGroup from "@/components/infoGroup"
import UploadArea from "@/components/uploadArea"
import { useTheme } from "next-themes"
import { useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { CircleHelp } from "lucide-react"

export default function Page() {
  const { setTheme } = useTheme()
  const instructionsText =
    "Please upload a video between (MMMDDYY and MMMDDYY) and fill out the information below.\n\n Thank you for sharing this video.  It will only be watched for assessment purposes, by physiotherapists certified in this type of assessment."

  useEffect(() => {
    setTheme("light")
  }, [setTheme])

  return (
    <div className="h-dvh max-w-dvw bg-white text-black">
      <header className="box-border flex h-[10%] items-center justify-between px-4 py-2 dark:bg-white">
        <Image
          className="h-full w-auto"
          src="/images/dda-logo.svg"
          alt="DDA logo"
          width={1338}
          height={472}
          priority
        />
        <CircleHelp className="size-6 text-black" />
      </header>

      {/* Desktop and Tablet View */}
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
            <div className="absolute right-0 h-full w-1 rounded-sm bg-black/50" />
          </div>
          <div className="box-border flex w-full flex-col px-20">
            <div className="flex flex-col gap-5">
              <section>
                <span className="text-xl font-medium">Instructions</span>
                <div className="h-0.5 w-full rounded-md bg-black/60" />
              </section>
              <span className="text-md whitespace-pre-line">
                {instructionsText}
              </span>
              <InfoGroup />
            </div>
          </div>
        </section>
      </div>

      {/* Mobile View */}
      <div className="h-auto w-dvw bg-white sm:hidden">
        <section className="box-border flex h-auto justify-center p-10">
          <h1 className="text-center font-medium text-black">
            General Movements Assessment (GMA) Video Portal for the Vancouver
            Infant Development Program
          </h1>
        </section>
        <section className="flex h-auto w-full flex-col gap-1 px-10">
          <h2 className="font-medium">Instructions</h2>
          <span className="text-md whitespace-pre-line">{instructionsText}</span>
          <UploadArea className="mt-4 w-full border-0 bg-mobile-button px-4 py-8 text-center text-black" />
        </section>

        <section className="mt-5 box-border px-10">
          <InfoGroup />
        </section>
      </div>

      <Link
        href="/setup"
        className="fixed right-3 bottom-3 z-40 rounded-md px-2 py-1 text-xs text-black/40 underline-offset-4 transition-colors hover:text-black/80 hover:underline"
      >
        Are you an admin?
      </Link>
    </div>
  )
}
