/**
 * Shared upload filename helpers (safe for server and client).
 */

function getFileExtension(filename: string) {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) return "";
  return filename.slice(lastDot);
}

export function formatDateTaken(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

function sanitizeNameForFilename(name: string) {
  return name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Naming scheme: `GMA Video Full Name DD.MM.YYYY_Age.ext`
 * e.g. `GMA Video Marcus Fan 24.07.2026_12.mp4`
 */
export function buildUploadFilename(
  originalName: string,
  dateTaken: Date,
  name: string,
  ageWeeks: number
) {
  const fullName = sanitizeNameForFilename(name) || "Unknown";
  const age = Math.max(0, Math.floor(ageWeeks));
  return `GMA Video ${fullName} ${formatDateTaken(dateTaken)}_${age}${getFileExtension(originalName)}`;
}

/** Parse a YYYY-MM-DD (or Date-parsable) value as a local calendar date. */
export function parseRecordedDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function formatRecordedDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
