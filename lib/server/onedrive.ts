import * as XLSX from "xlsx";
import type { WorkbookColumn, WorkbookColumnKind } from "../appConfig";
import { getSiteDriveBaseUrl, listSiteDrives, type GraphDrive } from "./auth";
import { getAppConfig } from "./configHelper";
import {
  driveBaseFromId,
  fetchGraphJson,
  getDriveItemByPath,
  type GraphDriveItem,
} from "./graph";

export type DriveFolderOption = {
  id: string;
  name: string;
};

export type DriveWorkbookOption = {
  id: string;
  name: string;
  driveId?: string;
};

const MAX_UPLOAD_FOLDER_OPTIONS = 250;
const MAX_UPLOAD_FOLDER_DEPTH = 3;
const MAX_WORKBOOKS = 200;
const GRAPH_LIST_CONCURRENCY = 8;
const WORKBOOK_FOLDER_DEPTH = 1;

type GraphChildrenPage = {
  value?: GraphDriveItem[];
  "@odata.nextLink"?: string;
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

async function listAllChildren(
  driveId: string,
  itemId: string,
  accessToken: string,
  select: string
): Promise<GraphDriveItem[]> {
  const childrenPath =
    itemId === "root"
      ? `${driveBaseFromId(driveId)}/root/children`
      : `${driveBaseFromId(driveId)}/items/${itemId}/children`;
  let nextUrl: string | undefined =
    `${childrenPath}?$select=${select}&$top=200`;
  const items: GraphDriveItem[] = [];
  while (nextUrl) {
    const page: GraphChildrenPage = await fetchGraphJson<GraphChildrenPage>(
      nextUrl,
      accessToken
    );
    items.push(...(page.value ?? []));
    nextUrl = page["@odata.nextLink"];
  }
  return items;
}

function isXlsxFile(item: GraphDriveItem) {
  return Boolean(
    item.file &&
      typeof item.name === "string" &&
      item.name.toLowerCase().endsWith(".xlsx")
  );
}

async function browseDrive(
  drive: GraphDrive,
  accessToken: string
): Promise<{
  folders: DriveFolderOption[];
  workbooks: DriveWorkbookOption[];
}> {
  if (!drive.id || !drive.name) {
    return { folders: [], workbooks: [] };
  }

  const folders: DriveFolderOption[] = [
    { id: drive.id, name: drive.name },
  ];
  const workbooks: DriveWorkbookOption[] = [];
  const driveId = drive.id;
  const driveName = drive.name;

  let rootChildren: GraphDriveItem[];
  try {
    rootChildren = await listAllChildren(
      driveId,
      "root",
      accessToken,
      "id,name,file,folder"
    );
  } catch {
    return { folders, workbooks };
  }

  const depth1Folders: Array<{ id: string; path: string }> = [];
  for (const item of rootChildren) {
    if (typeof item.id !== "string" || typeof item.name !== "string") continue;
    if (item.folder) {
      const path = `${driveName}/${item.name}`;
      folders.push({ id: item.id, name: path });
      depth1Folders.push({ id: item.id, path });
      continue;
    }
    if (isXlsxFile(item)) {
      workbooks.push({ id: item.id, name: item.name, driveId });
    }
  }

  const depth1Children = await mapPool(
    depth1Folders,
    GRAPH_LIST_CONCURRENCY,
    async (folder) => {
      try {
        return await listAllChildren(
          driveId,
          folder.id,
          accessToken,
          "id,name,file,folder"
        );
      } catch {
        return [] as GraphDriveItem[];
      }
    }
  );

  const depth2Folders: Array<{ id: string; path: string }> = [];
  depth1Children.forEach((items, index) => {
    const parent = depth1Folders[index];
    if (!parent) return;
    for (const item of items) {
      if (typeof item.id !== "string" || typeof item.name !== "string") continue;
      if (item.folder) {
        const path = `${parent.path}/${item.name}`;
        folders.push({ id: item.id, name: path });
        if (MAX_UPLOAD_FOLDER_DEPTH > 2) {
          depth2Folders.push({ id: item.id, path });
        }
        continue;
      }
      if (WORKBOOK_FOLDER_DEPTH >= 1 && isXlsxFile(item)) {
        workbooks.push({ id: item.id, name: item.name, driveId });
      }
    }
  });

  if (MAX_UPLOAD_FOLDER_DEPTH > 2) {
    const depth2Children = await mapPool(
      depth2Folders,
      GRAPH_LIST_CONCURRENCY,
      async (folder) => {
        try {
          return await listAllChildren(
            driveId,
            folder.id,
            accessToken,
            "id,name,folder"
          );
        } catch {
          return [] as GraphDriveItem[];
        }
      }
    );
    depth2Children.forEach((items, index) => {
      const parent = depth2Folders[index];
      if (!parent) return;
      for (const item of items) {
        if (!item.folder || typeof item.id !== "string" || typeof item.name !== "string") {
          continue;
        }
        folders.push({ id: item.id, name: `${parent.path}/${item.name}` });
      }
    });
  }

  return { folders, workbooks };
}

/**
 * Live SharePoint folder paths and .xlsx files for Settings dropdowns.
 * One walk per library (folders to depth 3, workbooks at root + one folder).
 */
export async function listSharePointBrowseOptions(accessToken: string): Promise<{
  folders: DriveFolderOption[];
  workbooks: DriveWorkbookOption[];
}> {
  const drives = await listSiteDrives(accessToken);
  const perDrive = await Promise.all(
    drives.map((drive) => browseDrive(drive, accessToken))
  );

  const folders: DriveFolderOption[] = [];
  const workbooks: DriveWorkbookOption[] = [];
  const seenFolders = new Set<string>();
  const seenWorkbooks = new Set<string>();

  for (const result of perDrive) {
    for (const folder of result.folders) {
      if (seenFolders.has(folder.name)) continue;
      seenFolders.add(folder.name);
      folders.push(folder);
    }
    for (const workbook of result.workbooks) {
      if (seenWorkbooks.has(workbook.name)) continue;
      seenWorkbooks.add(workbook.name);
      workbooks.push(workbook);
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  workbooks.sort((a, b) => a.name.localeCompare(b.name));
  return {
    folders: folders.slice(0, MAX_UPLOAD_FOLDER_OPTIONS),
    workbooks: workbooks.slice(0, MAX_WORKBOOKS),
  };
}

export async function listOneDriveRootFolders(
  accessToken: string
): Promise<DriveFolderOption[]> {
  return (await listSharePointBrowseOptions(accessToken)).folders;
}

export async function listOneDriveWorkbooks(
  accessToken: string
): Promise<DriveWorkbookOption[]> {
  return (await listSharePointBrowseOptions(accessToken)).workbooks;
}

export async function findOneDriveWorkbookByName(
  accessToken: string,
  filename: string
): Promise<DriveWorkbookOption | null> {
  const name = filename.trim();
  if (!name) return null;
  const { folderName } = await getAppConfig();
  const drives = await listSiteDrives(accessToken);
  const folder = folderName.trim();

  const preferred = (drive: GraphDrive) => {
    if (drive.name === folder) return 0;
    if (folder.includes("/") && drive.name === folder.split("/")[0]) return 0;
    if (drive.name === "Documents") return 1;
    return 2;
  };
  const ordered = [...drives].sort((a, b) => preferred(a) - preferred(b));

  const pathsForDrive = (drive: GraphDrive): string[] => {
    const paths = [name];
    if (!folder) return paths;
    if (drive.name === folder) return paths;
    const slash = folder.indexOf("/");
    if (slash > 0 && drive.name === folder.slice(0, slash)) {
      paths.push(`${folder.slice(slash + 1)}/${name}`);
    } else if (!folder.includes("/")) {
      paths.push(`${folder}/${name}`);
    }
    return paths;
  };

  const lookups = ordered.flatMap((drive, driveIndex) => {
    if (!drive.id) return [];
    const driveId = drive.id;
    const rankBase = preferred(drive) * 1000 + driveIndex * 10;
    return pathsForDrive(drive).map((path, pathIndex) =>
      (async (): Promise<{
        rank: number;
        option: DriveWorkbookOption;
      } | null> => {
        try {
          const item = await getDriveItemByPath(driveId, path, accessToken);
          if (
            item?.id &&
            item.file &&
            typeof item.name === "string" &&
            item.name.toLowerCase().endsWith(".xlsx")
          ) {
            return {
              rank: rankBase + pathIndex,
              option: { id: item.id, name: item.name, driveId },
            };
          }
        } catch {
          return null;
        }
        return null;
      })()
    );
  });

  const hits = (await Promise.all(lookups)).filter(
    (hit): hit is { rank: number; option: DriveWorkbookOption } => hit != null
  );
  hits.sort((a, b) => a.rank - b.rank);
  return hits[0]?.option ?? null;
}

async function loadWorkbookSheet(
  accessToken: string,
  workbookName: string,
  parseOptions: XLSX.ParsingOptions,
  options: { worksheetName?: string; requireWorksheet?: boolean } = {}
): Promise<{
  workbookName: string;
  sheet: XLSX.WorkSheet;
  sheetName: string;
  sheetNames: string[];
}> {
  const name = workbookName.trim();
  if (!name) {
    throw new Error("Reference workbook is not configured.");
  }

  const workbook = await findOneDriveWorkbookByName(accessToken, name);
  if (!workbook) {
    throw new Error(
      `Reference workbook "${name}" was not found in the SharePoint site.`
    );
  }

  const driveBase = workbook.driveId
    ? driveBaseFromId(workbook.driveId)
    : await getSiteDriveBaseUrl();
  const contentRes = await fetch(`${driveBase}/items/${workbook.id}/content`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
    redirect: "follow",
  });
  if (!contentRes.ok) {
    const details = await contentRes.text();
    throw new Error(
      `Could not download "${name}" (${contentRes.status}): ${
        details || contentRes.statusText
      }`
    );
  }

  const buffer = Buffer.from(await contentRes.arrayBuffer());
  const parsed = XLSX.read(buffer, parseOptions);
  const sheetNames = parsed.SheetNames.filter(
    (sheetName) => Boolean(sheetName) && Boolean(parsed.Sheets[sheetName])
  );
  if (sheetNames.length === 0) {
    throw new Error(`No worksheets found in "${name}".`);
  }

  const requested = options.worksheetName?.trim() ?? "";
  if (requested && !sheetNames.includes(requested)) {
    if (options.requireWorksheet) {
      throw new Error(`Worksheet "${requested}" was not found in "${name}".`);
    }
  }

  const sheetName =
    requested && sheetNames.includes(requested) ? requested : sheetNames[0];

  return {
    workbookName: name,
    sheet: parsed.Sheets[sheetName],
    sheetName,
    sheetNames,
  };
}

const WORKBOOK_COLUMN_SAMPLE_ROWS = 50;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isIsoDateString(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const match = ISO_DATE_RE.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatLocalIsoDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isExcelDateFormat(fmt: string): boolean {
  const isDate = XLSX.SSF?.is_date as ((value: string) => boolean) | undefined;
  if (typeof isDate !== "function") return false;
  try {
    return Boolean(isDate(fmt));
  } catch {
    return false;
  }
}

function cellLooksLikeDate(cell: XLSX.CellObject): boolean {
  if (isIsoDateString(cell.v) || isIsoDateString(cell.w)) return true;
  if (cell.t === "d") return true;
  if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) return true;
  if (cell.z == null) return false;
  const fmt = String(cell.z).trim();
  return fmt.length > 0 && isExcelDateFormat(fmt);
}

function headerCellName(
  sheet: XLSX.WorkSheet,
  row: number,
  col: number
): string {
  const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })] as
    XLSX.CellObject | undefined;
  if (!cell) return "";
  if (typeof cell.w === "string" && cell.w.trim()) return cell.w.trim();
  return cellToDisplayString(cell.v);
}

function inferColumnKind(
  sheet: XLSX.WorkSheet,
  col: number,
  headerRow: number,
  lastRow: number
): WorkbookColumnKind {
  let text = 0;
  let date = 0;
  let number = 0;
  let booleanCount = 0;
  const end = Math.min(lastRow, headerRow + WORKBOOK_COLUMN_SAMPLE_ROWS);

  for (let row = headerRow + 1; row <= end; row++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })] as
      XLSX.CellObject | undefined;
    if (!cell || cell.t === "z" || cell.v == null || cell.v === "") continue;

    if (cellLooksLikeDate(cell)) {
      date += 1;
      continue;
    }

    const type = cell.t as string;
    if (type === "s" || type === "str") {
      text += 1;
    } else if (type === "n") {
      number += 1;
    } else if (type === "b") {
      booleanCount += 1;
    }
  }

  const total = text + date + number + booleanCount;
  if (total === 0) return "unknown";
  const max = Math.max(text, date, number, booleanCount);
  if (date === max) return "date";
  if (text === max) return "text";
  if (number === max) return "number";
  if (booleanCount === max) return "boolean";
  return "unknown";
}

function columnsFromSheet(sheet: XLSX.WorkSheet): WorkbookColumn[] {
  const ref = sheet["!ref"];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const seen = new Set<string>();
  const columns: WorkbookColumn[] = [];

  for (let col = range.s.c; col <= range.e.c; col++) {
    const header = headerCellName(sheet, range.s.r, col);
    if (!header) continue;
    const key = header.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    columns.push({
      name: header,
      letter: XLSX.utils.encode_col(col),
      kind: inferColumnKind(sheet, col, range.s.r, range.e.r),
    });
  }

  return columns;
}

/**
 * First-row headers from the given workbook page, with value kinds inferred
 * from cell types, YYYY-MM-DD text, and Excel number formats.
 */
export async function listReferenceWorkbookColumns(
  accessToken: string,
  workbookName: string,
  worksheetName?: string
): Promise<{
  workbookName: string;
  sheetName: string;
  sheets: string[];
  columns: WorkbookColumn[];
}> {
  const {
    workbookName: name,
    sheet,
    sheetName,
    sheetNames,
  } = await loadWorkbookSheet(
    accessToken,
    workbookName,
    {
      type: "buffer",
      cellDates: true,
      cellNF: true,
    },
    { worksheetName }
  );

  return {
    workbookName: name,
    sheetName,
    sheets: sheetNames,
    columns: columnsFromSheet(sheet),
  };
}

function columnLetterToIndex(letter: string): number | null {
  // Excel columns are A..XFD (at most 3 letters). Longer strings like "Name"
  // must be treated as header labels, not column letters.
  const trimmed = letter.trim().toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(trimmed)) return null;

  let index = 0;
  for (const char of trimmed) {
    index = index * 26 + (char.codePointAt(0)! - 64);
  }
  return index - 1;
}

function cellToDisplayString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function resolveColumnIndex(
  headerRow: unknown[],
  columnSpec: string,
  columnLabel = "Column"
): number {
  const target = columnSpec.trim();
  if (!target) {
    throw new Error(`${columnLabel} is not configured.`);
  }

  // Prefer matching the first-row header text so values like "Name" / "EDC"
  // are never misread as Excel column letters.
  const headerIndex = headerRow.findIndex(
    (cell) => cellToDisplayString(cell).toLowerCase() === target.toLowerCase()
  );
  if (headerIndex !== -1) return headerIndex;

  const letterIndex = columnLetterToIndex(target);
  if (letterIndex !== null) {
    return letterIndex;
  }

  throw new Error(
    `Could not find column "${columnSpec}" in the first row of the reference workbook.`
  );
}

function resolveOptionalEmailColumnIndex(headerRow: unknown[]): number | null {
  const headers = headerRow.map((cell) =>
    cellToDisplayString(cell).toLowerCase()
  );
  const preferred = [
    "family email",
    "family e-mail",
    "parent email",
    "guardian email",
    "caregiver email",
    "email",
    "e-mail",
  ];
  for (const name of preferred) {
    const index = headers.findIndex((header) => header === name);
    if (index !== -1) return index;
  }
  const fuzzy = headers.findIndex(
    (header) => header.includes("email") || header.includes("e-mail")
  );
  return fuzzy === -1 ? null : fuzzy;
}

function parseWorkbookEmail(value: unknown): string | null {
  const text = cellToDisplayString(value);
  if (!text) return null;
  const match = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  return match?.[0] ?? null;
}

function parseWorkbookDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (isIsoDateString(trimmed)) return trimmed;
    const date = new Date(trimmed);
    return formatLocalIsoDate(date);
  }

  if (value instanceof Date) {
    return formatLocalIsoDate(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const date = new Date(parsed.y, parsed.m - 1, parsed.d);
    return formatLocalIsoDate(date);
  }

  return null;
}

export type ReferenceChild = {
  name: string;
  /** ISO date (YYYY-MM-DD) from the EDC column, when parseable. */
  edc: string | null;
  /** Family/parent email from the workbook, when present. */
  familyEmail: string | null;
};

/**
 * Children from the configured reference workbook (name + EDC),
 * in sheet order (first occurrence kept if duplicate names).
 */
export async function listChildNamesFromReferenceWorkbook(
  accessToken: string
): Promise<{
  children: ReferenceChild[];
  names: string[];
  workbookName: string;
  column: string;
  edcColumn: string;
}> {
  const config = await getAppConfig();
  const workbookName = config.referenceSheetName.trim();
  const worksheetName = config.referenceWorksheetName.trim();
  const column = config.childNameColumn.trim();
  const edcColumn = config.edcColumn.trim();

  if (!workbookName) {
    throw new Error("Reference workbook is not configured.");
  }
  if (!column) {
    throw new Error("Child name column is not configured.");
  }
  if (!edcColumn) {
    throw new Error("EDC column is not configured.");
  }

  const { sheet } = await loadWorkbookSheet(
    accessToken,
    workbookName,
    {
      type: "buffer",
      cellDates: true,
    },
    { worksheetName, requireWorksheet: Boolean(worksheetName) }
  );
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (rows.length === 0) {
    return { children: [], names: [], workbookName, column, edcColumn };
  }

  const headerRow = (rows[0] ?? []) as unknown[];
  const nameIndex = resolveColumnIndex(headerRow, column, "Child name column");
  const edcIndex = resolveColumnIndex(headerRow, edcColumn, "EDC column");
  const emailIndex = resolveOptionalEmailColumnIndex(headerRow);
  const seen = new Set<string>();
  const children: ReferenceChild[] = [];

  for (const row of rows.slice(1)) {
    const cells = (row ?? []) as unknown[];
    const name = cellToDisplayString(cells[nameIndex]);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    children.push({
      name,
      edc: parseWorkbookDate(cells[edcIndex]),
      familyEmail:
        emailIndex == null ? null : parseWorkbookEmail(cells[emailIndex]),
    });
  }

  return {
    children,
    names: children.map((child) => child.name),
    workbookName,
    column,
    edcColumn,
  };
}
