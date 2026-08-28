import { getOneDriveAccessToken } from "./auth";
import { getAppConfig } from "./configHelper";
import { driveBaseFromId, fetchGraphJson } from "./graph";
import { findOneDriveWorkbookByName } from "./onedrive";

const GMA_TO_SEND_SHEET = "GMA-to send";
const GMA_DONE_SHEET = "GMA done or not received";

/** First-row header to stamp with today's date when a parent upload succeeds. */
const RECEIVED_COLUMN = "video received";

type WorkbookSession = { id?: string };

type WorksheetRef = { id: string; name: string };

type UsedRange = {
  address?: string;
  values?: unknown[][];
};

type RangePayload = {
  values?: unknown[][];
  numberFormat?: unknown[][];
};

export type EditedWorkbookRow = {
  sheetName: string;
  row: number;
};

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function graphCellValue(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  return cellText(value);
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

function lettersToColumnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function parseA1Start(address?: string): { row: number; col: number } {
  if (!address) return { row: 1, col: 0 };
  const local = address
    .replace(/^.*!/, "")
    .replace(/\$/g, "")
    .split(":")[0]
    ?.trim();
  const match = /^([A-Za-z]+)(\d+)$/.exec(local ?? "");
  if (!match) return { row: 1, col: 0 };
  return {
    row: Number(match[2]),
    col: lettersToColumnIndex(match[1]),
  };
}

function headerColumnIndex(headerRow: unknown[], spec: string): number {
  const target = spec.trim();
  if (!target) return -1;
  return headerRow.findIndex(
    (cell) => cellText(cell).toLowerCase() === target.toLowerCase()
  );
}

function normalizeHeader(value: string): string {
  return cellText(value)
    .toLowerCase()
    .replace(/\(s\)/g, "s")
    .replace(/[+&/_.,-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemHeader(value: string): string {
  return normalizeHeader(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.replace(/s$/, ""))
    .join(" ");
}

/**
 * Match source/dest headers even when order differs or labels vary slightly
 * (e.g. "parent names + phone number" vs "phone number(s)").
 */
function headersEquivalent(sourceHeader: string, destHeader: string): boolean {
  const source = stemHeader(sourceHeader);
  const dest = stemHeader(destHeader);
  if (!source || !dest) return false;
  if (source === dest) return true;
  const shorter = source.length <= dest.length ? source : dest;
  const longer = source.length <= dest.length ? dest : source;
  if (shorter.split(" ").length < 2) return false;
  return ` ${longer} `.includes(` ${shorter} `);
}

function mapRowByHeaders(
  sourceHeaders: unknown[],
  sourceValues: unknown[],
  destHeaders: unknown[]
): unknown[] {
  const usedSource = new Set<number>();
  return destHeaders.map((destHeader) => {
    const destName = cellText(destHeader);
    if (!destName) return "";

    let match = sourceHeaders.findIndex((header, index) => {
      return (
        !usedSource.has(index) &&
        cellText(header).toLowerCase() === destName.toLowerCase()
      );
    });
    if (match < 0) {
      match = sourceHeaders.findIndex((header, index) => {
        return (
          !usedSource.has(index) && headersEquivalent(cellText(header), destName)
        );
      });
    }
    if (match < 0) return "";
    usedSource.add(match);
    return sourceValues[match] ?? "";
  });
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sessionInit(sessionId: string, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Workbook-Session-Id", sessionId);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return { ...init, headers };
}

function worksheetPath(sheet: WorksheetRef) {
  return `worksheets/${encodeURIComponent(sheet.id)}`;
}

function resolveWorksheet(
  sheets: WorksheetRef[],
  wanted: string
): WorksheetRef | undefined {
  const target = wanted.trim().toLowerCase();
  if (!target) return undefined;
  return (
    sheets.find((sheet) => sheet.name.trim().toLowerCase() === target) ??
    sheets.find((sheet) => {
      const name = sheet.name.trim().toLowerCase();
      if (target.includes("done")) {
        return name.includes("done") && name.includes("received");
      }
      if (target.includes("to send")) {
        return name.includes("to send");
      }
      return false;
    })
  );
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

async function openReferenceWorkbook() {
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

  return {
    accessToken,
    nameColumn,
    referenceWorksheetName: config.referenceWorksheetName.trim(),
    workbookBase: `${driveBaseFromId(workbook.driveId)}/items/${encodeURIComponent(workbook.id)}/workbook`,
  };
}

async function listWorksheets(
  workbookBase: string,
  accessToken: string,
  sessionId: string
): Promise<WorksheetRef[]> {
  const payload = await fetchGraphJson<{ value?: WorksheetRef[] }>(
    `${workbookBase}/worksheets?$select=id,name`,
    accessToken,
    sessionInit(sessionId)
  );
  return (payload.value ?? []).filter(
    (sheet): sheet is WorksheetRef => Boolean(sheet?.id && sheet?.name)
  );
}

async function getUsedRange(
  workbookBase: string,
  accessToken: string,
  sessionId: string,
  sheet: WorksheetRef
): Promise<UsedRange> {
  return fetchGraphJson<UsedRange>(
    `${workbookBase}/${worksheetPath(sheet)}/usedRange?$select=address,values`,
    accessToken,
    sessionInit(sessionId)
  );
}

function findChildRow(
  used: UsedRange,
  childName: string,
  nameColumn: string
): { excelRow: number; rowValues: unknown[]; headerRow: unknown[] } | null {
  const values = used.values ?? [];
  if (values.length < 2) return null;
  const start = parseA1Start(used.address);
  const headerRow = values[0] ?? [];
  const nameCol = headerColumnIndex(headerRow, nameColumn);
  if (nameCol < 0) return null;
  const target = childName.trim().toLowerCase();
  const dataIndex = values.slice(1).findIndex((row) => {
    return cellText((row ?? [])[nameCol]).toLowerCase() === target;
  });
  if (dataIndex < 0) return null;
  return {
    excelRow: start.row + 1 + dataIndex,
    rowValues: [...(values[dataIndex + 1] ?? [])],
    headerRow,
  };
}

function nextClearDataRow(used: UsedRange): number {
  const values = used.values ?? [];
  const start = parseA1Start(used.address);
  let lastOccupied = start.row;
  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? [];
    if (row.some((cell) => cellText(cell))) {
      lastOccupied = start.row + i;
    }
  }
  return lastOccupied + 1;
}

async function patchRow(
  workbookBase: string,
  accessToken: string,
  sessionId: string,
  sheet: WorksheetRef,
  excelRow: number,
  startCol: number,
  values: unknown[],
  numberFormat?: unknown[]
) {
  const cells = values.map(graphCellValue);
  const lastCol = columnIndexToLetter(startCol + Math.max(cells.length, 1) - 1);
  const start = `${columnIndexToLetter(startCol)}${excelRow}`;
  const body: RangePayload = { values: [cells] };
  if (numberFormat?.length) {
    body.numberFormat = [numberFormat];
  }
  await fetchGraphJson(
    `${workbookBase}/${worksheetPath(sheet)}/range(address='${start}:${lastCol}${excelRow}')`,
    accessToken,
    sessionInit(sessionId, {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  );
}

async function deleteOrClearRow(
  workbookBase: string,
  accessToken: string,
  sessionId: string,
  sheet: WorksheetRef,
  excelRow: number,
  startCol: number,
  columnCount: number
) {
  const lastCol = columnIndexToLetter(startCol + Math.max(columnCount, 1) - 1);
  const address = `${columnIndexToLetter(startCol)}${excelRow}:${lastCol}${excelRow}`;
  try {
    await fetchGraphJson(
      `${workbookBase}/${worksheetPath(sheet)}/range(address='${address}')/delete`,
      accessToken,
      sessionInit(sessionId, {
        method: "POST",
        body: JSON.stringify({ shift: "Up" }),
      })
    );
  } catch (error) {
    console.error("Workbook row delete failed, clearing cells instead:", error);
    await patchRow(
      workbookBase,
      accessToken,
      sessionId,
      sheet,
      excelRow,
      startCol,
      Array.from({ length: Math.max(columnCount, 1) }, () => "")
    );
  }
}

/**
 * After a parent upload, find that child's row and stamp today's date
 * (YYYY-MM-DD) in the video-received column.
 */
export async function fillUploadReceived(
  childName: string
): Promise<EditedWorkbookRow> {
  const name = childName.trim();
  if (!name) {
    throw new Error("A child name is required to update the workbook.");
  }

  const { accessToken, nameColumn, referenceWorksheetName, workbookBase } =
    await openReferenceWorkbook();

  const wantedSheets = [
    ...new Set(
      [GMA_TO_SEND_SHEET, referenceWorksheetName, GMA_DONE_SHEET].filter(
        Boolean
      )
    ),
  ];

  return withWorkbookSession(workbookBase, accessToken, async (sessionId) => {
    const sheets = await listWorksheets(workbookBase, accessToken, sessionId);

    for (const wanted of wantedSheets) {
      const sheet = resolveWorksheet(sheets, wanted);
      if (!sheet) continue;

      let used: UsedRange;
      try {
        used = await getUsedRange(workbookBase, accessToken, sessionId, sheet);
      } catch {
        continue;
      }

      const found = findChildRow(used, name, nameColumn);
      if (!found) continue;

      const receivedCol = headerColumnIndex(found.headerRow, RECEIVED_COLUMN);
      if (receivedCol < 0) {
        throw new Error(
          `Found "${name}" on row ${found.excelRow} of "${sheet.name}", but no "${RECEIVED_COLUMN}" column.`
        );
      }

      const startCol = parseA1Start(used.address).col;
      const receivedOn = todayIsoDate();
      await patchRow(
        workbookBase,
        accessToken,
        sessionId,
        sheet,
        found.excelRow,
        startCol + receivedCol,
        [receivedOn],
        ["yyyy-mm-dd"]
      );
      return { sheetName: sheet.name, row: found.excelRow };
    }

    const available = sheets.map((sheet) => sheet.name).join('", "');
    throw new Error(
      `Could not find "${name}" on "${wantedSheets.join('", "')}". Worksheets in file: "${available}".`
    );
  });
}

/**
 * Cut the child's row from the sheet it was just edited on and append it to
 * the next empty data row on GMA done or not received.
 */
export async function moveEditedRowToDoneSheet(
  childName: string,
  edited?: EditedWorkbookRow
): Promise<{ destRow: number }> {
  const name = childName.trim();
  if (!name) {
    throw new Error("A child name is required to move the workbook row.");
  }

  const { accessToken, nameColumn, referenceWorksheetName, workbookBase } =
    await openReferenceWorkbook();

  return withWorkbookSession(workbookBase, accessToken, async (sessionId) => {
    const sheets = await listWorksheets(workbookBase, accessToken, sessionId);
    const doneSheet = resolveWorksheet(sheets, GMA_DONE_SHEET);
    if (!doneSheet) {
      throw new Error(
        `Worksheet "${GMA_DONE_SHEET}" was not found. Worksheets in file: "${sheets
          .map((sheet) => sheet.name)
          .join('", "')}".`
      );
    }

    if (edited?.sheetName) {
      const editedSheet = resolveWorksheet(sheets, edited.sheetName);
      if (editedSheet && editedSheet.id === doneSheet.id) {
        return { destRow: edited.row };
      }
    }

    const sourceWanted = [
      ...new Set(
        [edited?.sheetName, GMA_TO_SEND_SHEET, referenceWorksheetName].filter(
          (sheet): sheet is string => Boolean(sheet)
        )
      ),
    ];

    let sourceSheet: WorksheetRef | undefined;
    let sourceRow = 0;
    let rowValues: unknown[] = [];
    let sourceHeaders: unknown[] = [];
    let sourceStartCol = 0;

    for (const wanted of sourceWanted) {
      const sheet = resolveWorksheet(sheets, wanted);
      if (!sheet || sheet.id === doneSheet.id) continue;
      let used: UsedRange;
      try {
        used = await getUsedRange(workbookBase, accessToken, sessionId, sheet);
      } catch {
        continue;
      }
      const found = findChildRow(used, name, nameColumn);
      if (!found) continue;
      sourceSheet = sheet;
      sourceRow = found.excelRow;
      rowValues = found.rowValues.map(graphCellValue);
      sourceHeaders = found.headerRow;
      sourceStartCol = parseA1Start(used.address).col;
      break;
    }

    if (!sourceSheet || sourceRow < 2) {
      const destUsed = await getUsedRange(
        workbookBase,
        accessToken,
        sessionId,
        doneSheet
      );
      const alreadyMoved = findChildRow(destUsed, name, nameColumn);
      if (alreadyMoved) {
        return { destRow: alreadyMoved.excelRow };
      }
      throw new Error(
        `Could not find "${name}" on "${sourceWanted.join('", "')}" to move.`
      );
    }

    const destUsed = await getUsedRange(
      workbookBase,
      accessToken,
      sessionId,
      doneSheet
    );
    const destStartCol = parseA1Start(destUsed.address).col;
    const destRow = nextClearDataRow(destUsed);
    const destHeaders = destUsed.values?.[0] ?? [];
    const mapped = mapRowByHeaders(sourceHeaders, rowValues, destHeaders);

    await patchRow(
      workbookBase,
      accessToken,
      sessionId,
      doneSheet,
      destRow,
      destStartCol,
      mapped
    );

    await deleteOrClearRow(
      workbookBase,
      accessToken,
      sessionId,
      sourceSheet,
      sourceRow,
      sourceStartCol,
      Math.max(rowValues.length, 1)
    );

    return { destRow };
  });
}
