import { getOneDriveAccessToken } from "./auth";
import { getAppConfig } from "./configHelper";
import { driveBaseFromId, fetchGraphJson } from "./graph";
import { findOneDriveWorkbookByName } from "./onedrive";

const GMA_TO_SEND_SHEET = "GMA-to send";
const GMA_DONE_SHEET = "GMA done or not received";

/** First-row header to stamp with today's date when a parent upload succeeds. */
const RECEIVED_COLUMN = "video received";

type WorkbookSession = { id?: string };

type UsedRange = {
  address?: string;
  values?: unknown[][];
};

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function columnIndexToLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function headerColumnIndex(headerRow: unknown[], spec: string): number {
  const target = spec.trim();
  if (!target) return -1;
  const byName = headerRow.findIndex(
    (cell) => cellText(cell).toLowerCase() === target.toLowerCase()
  );
  if (byName !== -1) return byName;
  return -1;
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function withWorkbookSession<T>(
  workbookBase: string,
  accessToken: string,
  run: (sessionId: string) => Promise<T>
): Promise<T> {
  const session = await fetchGraphJson<WorkbookSession>(
    `${workbookBase}/createSession`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persistChanges: true }),
    }
  );
  const sessionId = session.id?.trim();
  if (!sessionId) {
    throw new Error("Excel session did not return an id.");
  }

  try {
    return await run(sessionId);
  } finally {
    await fetchGraphJson(`${workbookBase}/closeSession`, accessToken, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Workbook-Session-Id": sessionId,
      },
    }).catch(() => undefined);
  }
}

function sessionInit(sessionId: string, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Workbook-Session-Id", sessionId);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return { ...init, headers };
}

/**
 * After a parent upload, find that child's row on the GMA tracking sheets
 * (by the configured name column) and stamp a received-date column.
 */
export async function fillUploadReceived(childName: string): Promise<void> {
  const name = childName.trim();
  if (!name) {
    throw new Error("A child name is required to update the workbook.");
  }

  const config = await getAppConfig();
  const workbookName = config.referenceSheetName.trim();
  const nameColumn = config.childNameColumn.trim();
  if (!workbookName) {
    throw new Error("Reference workbook is not configured.");
  }
  if (!nameColumn) {
    throw new Error("Child name column is not configured.");
  }

  const accessToken = await getOneDriveAccessToken();
  const workbook = await findOneDriveWorkbookByName(accessToken, workbookName);
  if (!workbook?.id || !workbook.driveId) {
    throw new Error(`Reference workbook "${workbookName}" was not found.`);
  }

  const workbookBase = `${driveBaseFromId(workbook.driveId)}/items/${encodeURIComponent(workbook.id)}/workbook`;
  const sheetsToSearch = [
    ...new Set(
      [
        GMA_TO_SEND_SHEET,
        config.referenceWorksheetName.trim(),
        GMA_DONE_SHEET,
      ].filter(Boolean)
    ),
  ];

  await withWorkbookSession(workbookBase, accessToken, async (sessionId) => {
    for (const sheetName of sheetsToSearch) {
      const sheetPath = encodeURIComponent(sheetName);
      let used: UsedRange;
      try {
        used = await fetchGraphJson<UsedRange>(
          `${workbookBase}/worksheets/${sheetPath}/usedRange?$select=address,values`,
          accessToken,
          sessionInit(sessionId)
        );
      } catch {
        continue;
      }

      const values = used.values ?? [];
      if (values.length < 2) continue;

      const headerRow = values[0] ?? [];
      const nameCol = headerColumnIndex(headerRow, nameColumn);
      if (nameCol < 0) continue;

      const dataIndex = values.slice(1).findIndex((row) => {
        return (
          cellText((row ?? [])[nameCol]).toLowerCase() === name.toLowerCase()
        );
      });
      if (dataIndex < 0) continue;

      const excelRow = dataIndex + 2;
      const receivedCol = headerColumnIndex(headerRow, RECEIVED_COLUMN);
      if (receivedCol < 0) {
        throw new Error(
          `Found "${name}" on row ${excelRow} of "${sheetName}", but no "${RECEIVED_COLUMN}" column.`
        );
      }

      const address = `${columnIndexToLetter(receivedCol)}${excelRow}`;
      const receivedOn = todayIsoDate();
      await fetchGraphJson(
        `${workbookBase}/worksheets/${sheetPath}/range(address='${address}')`,
        accessToken,
        sessionInit(sessionId, {
          method: "PATCH",
          body: JSON.stringify({
            values: [[receivedOn]],
            numberFormat: [["yyyy-mm-dd"]],
          }),
        })
      );
      return;
    }

    throw new Error(
      `Could not find "${name}" on "${sheetsToSearch.join('", "')}".`
    );
  });
}
