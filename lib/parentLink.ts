/** Path for a parent upload invitation (token in the URL). */
export function parentLinkPath(token: string) {
  return `/link/${encodeURIComponent(token)}`;
}

/** Path for the gated upload form after the invitation cookie is set. */
export const PARENT_UPLOAD_PATH = "/link";
