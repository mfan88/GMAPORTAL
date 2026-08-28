import type { NextRequest } from "next/server";
import { getAppOrigin } from "./msalHelpers";

export function toRequestShape(request: NextRequest) {
  return {
    headers: {
      host: request.headers.get("host") ?? undefined,
      "x-forwarded-host": request.headers.get("x-forwarded-host") ?? undefined,
      "x-forwarded-proto":
        request.headers.get("x-forwarded-proto") ?? undefined,
      cookie: request.headers.get("cookie") ?? undefined,
    },
  };
}

/**
 * Build an absolute public URL. Never use `request.url` as the base behind
 * Cloudways/nginx — Next often sees http(s)://localhost:PORT internally.
 */
export function publicUrl(path: string, request: NextRequest): URL {
  const origin = getAppOrigin(toRequestShape(request));
  return new URL(path, `${origin}/`);
}
