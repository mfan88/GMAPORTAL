"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const TEN_MINUTES_MS = 10 * MINUTE_MS;
const SECOND_MS = 1000;

function formatCountdown(remainingMs: number): {
  kind: "days" | "hours" | "mins" | "secs";
  text: string;
} {
  if (remainingMs < MINUTE_MS) {
    const seconds = Math.min(
      59,
      Math.max(1, Math.ceil(remainingMs / SECOND_MS))
    );
    return {
      kind: "secs",
      text: seconds === 1 ? "1 sec" : `${seconds} secs`,
    };
  }

  if (remainingMs < TEN_MINUTES_MS) {
    const minutes = Math.floor(remainingMs / MINUTE_MS);
    const seconds = Math.floor((remainingMs % MINUTE_MS) / SECOND_MS);
    const minutesLabel = minutes === 1 ? "1 min" : `${minutes} mins`;
    const secondsLabel = `${String(seconds).padStart(2, "0")} secs`;
    return {
      kind: "mins",
      text: `${minutesLabel} and ${secondsLabel}`,
    };
  }

  if (remainingMs >= DAY_MS) {
    const days = Math.max(1, Math.floor(remainingMs / DAY_MS));
    return {
      kind: "days",
      text: days === 1 ? "1 day" : `${days} days`,
    };
  }

  const hours = Math.floor(remainingMs / HOUR_MS);
  const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS);
  const hoursLabel = hours === 1 ? "1 hr" : `${hours} hrs`;
  const minutesLabel = minutes === 1 ? "1 min" : `${minutes} mins`;

  if (hours === 0) {
    return { kind: "hours", text: minutesLabel };
  }
  if (minutes === 0) {
    return { kind: "hours", text: hoursLabel };
  }
  return {
    kind: "hours",
    text: `${hoursLabel} and ${minutesLabel}`,
  };
}

export default function LinkPendingCountdown({
  availableAt,
  token,
}: Readonly<{
  availableAt: number;
  token?: string;
}>) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, availableAt - now);
  const countdown = formatCountdown(remainingMs);
  const isReady = remainingMs <= 0;

  useEffect(() => {
    if (!isReady) return;
    const destination = token
      ? `/portalaccess/${encodeURIComponent(token)}`
      : "/";
    const timeout = window.setTimeout(() => {
      router.replace(destination);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [isReady, router, token]);

  if (isReady) {
    return (
      <div className="flex max-w-xl flex-col items-center gap-3 text-center">
        <p className="text-lg text-black">
          Your link is ready. Taking you to the upload page…
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col items-center gap-3 text-center">
      <p className="text-base text-black sm:text-lg">
        This upload link will be available in:
      </p>
      <p className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
        {countdown.text}
      </p>
      <p className="text-base text-black sm:text-lg">
        Please wait until then to upload your video. Thank you.
      </p>
    </div>
  );
}
