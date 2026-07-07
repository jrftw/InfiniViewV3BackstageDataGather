/**
 * Filename: parseWorkbook.ts
 * Purpose: Parse Backstage Excel exports into normalized row objects.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: xlsx
 * Platform Compatibility: Node.js 18+
 */

import * as XLSX from "xlsx";
import { logDebug, logInfo } from "../logging/logger";
import {
  GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES,
  GATHERER_BACKSTAGE_MANAGE_CREATORS_FIELD_ALIASES,
  gathererBackstageFieldBuildParseWorkbookAliasMap,
} from "./gathererBackstageFieldAliasCatalog";
import {
  parseWorkbookPerformanceColumnsMissingCriticalFields,
  parseWorkbookPerformanceColumnsRemapRows,
  ParseWorkbookPerformanceColumnMap,
} from "./parseWorkbookPerformanceColumns";

// MARK: - Types

export interface ParsedBackstageRow {
  [key: string]: unknown;
  _rowIndex: number;
  _sourceSheet: string;
}

export interface ParsedWorkbookResult {
  rows: ParsedBackstageRow[];
  headers: string[];
  missingColumns: string[];
  rawHeaders: string[];
  performanceColumnMap?: ParseWorkbookPerformanceColumnMap;
}

// MARK: - Header Normalization

function parseWorkbookNormalizeHeader(header: string): string {
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_");
}

function parseWorkbookHeaderMatchKey(header: string): string {
  return parseWorkbookNormalizeHeader(header).replace(/_/g, "");
}

// MARK: - Column Aliases (Backstage export variants)

const PARSE_WORKBOOK_COLUMN_ALIASES: Record<string, string[]> = {
  creator: ["creator", "creators", "creators_username", "tiktok_creator", "username", "handle"],
  creator_id: ["creator_id", "creatorid", "creators_id", "backstage_creator_id", "uid"],
  joined_time: ["joined_time", "joinedtime", "join_time", "joined_date", "join_date"],
  notes: ["notes", "note", "creator_notes"],
  relationship_status: ["relationship_status", "relationshipstatus", "relationship"],
  graduation_status: ["graduation_status", "graduationstatus", "graduation"],
  tier_status: ["tier_status", "tierstatus", "tier"],
  days_since_joining: ["days_since_joining", "dayssincejoining", "days_joined"],
  ...gathererBackstageFieldBuildParseWorkbookAliasMap(GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES),
  ...gathererBackstageFieldBuildParseWorkbookAliasMap(GATHERER_BACKSTAGE_MANAGE_CREATORS_FIELD_ALIASES),
};

const PERFORMANCE_EXPECTED_COLUMNS = [
  "creator",
  "creator_id",
  "joined_time",
  "days_since_joining",
  "graduation_status",
  "tier_status",
  "total_diamonds",
  "live_duration",
  "valid_go_live_days",
  "data_period",
];

const MANAGEMENT_EXPECTED_COLUMNS = [
  "creator",
  "creator_id",
  "notes",
  "relationship_status",
  "graduation_status",
  "tier_status",
  "diamonds_l30d",
];

// MARK: - Header Row Detection

function parseWorkbookFindHeaderRowIndex(sheetRows: unknown[][]): number {
  for (let i = 0; i < Math.min(sheetRows.length, 10); i++) {
    const row = sheetRows[i];
    if (!Array.isArray(row)) continue;
    const normalizedCells = row.map((c) => parseWorkbookHeaderMatchKey(String(c ?? "")));
    const hasCreator = normalizedCells.some(
      (c) => c === "creator" || c === "creatorid" || c.includes("creator")
    );
    if (hasCreator) {
      return i;
    }
  }
  return 0;
}

function parseWorkbookHeaderMatchesExpected(
  normalizedHeaders: string[],
  expectedColumn: string
): boolean {
  const aliases = PARSE_WORKBOOK_COLUMN_ALIASES[expectedColumn] ?? [expectedColumn];
  const aliasKeys = aliases.map(parseWorkbookHeaderMatchKey);

  return normalizedHeaders.some((header) => {
    const headerKey = parseWorkbookHeaderMatchKey(header);
    return aliasKeys.some(
      (alias) => headerKey === alias || headerKey.includes(alias) || alias.includes(headerKey)
    );
  });
}

// MARK: - Creator ID Cell Extraction

/** Reads full-precision Creator ID text from sheet cells (avoids Excel float rounding). */
function parseWorkbookReadCreatorIdCell(sheet: XLSX.WorkSheet, rowNumber1Based: number, colIndex: number): string | null {
  const address = XLSX.utils.encode_cell({ r: rowNumber1Based - 1, c: colIndex });
  const cell = sheet[address] as XLSX.CellObject | undefined;
  if (!cell) {
    return null;
  }
  if (cell.w !== undefined && cell.w !== null && String(cell.w).trim() !== "") {
    return String(cell.w).trim();
  }
  if (cell.v !== undefined && cell.v !== null) {
    return String(cell.v).trim();
  }
  return null;
}

function parseWorkbookFindCreatorIdColumnIndex(rawHeaders: string[]): number {
  for (let i = 0; i < rawHeaders.length; i++) {
    const key = parseWorkbookHeaderMatchKey(rawHeaders[i] ?? "");
    if (key === "creatorid" || key === "creator_id" || key.endsWith("creatorid")) {
      return i;
    }
  }
  return -1;
}

// MARK: - Workbook Parser

export function parseBackstageWorkbook(
  filePath: string,
  reportType: "performance" | "management"
): ParsedWorkbookResult {
  logDebug(`Parsing workbook: ${filePath}`, "parseWorkbook");
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][];

  const headerRowIndex = parseWorkbookFindHeaderRowIndex(sheetRows);
  const rawHeaderRow = sheetRows[headerRowIndex] ?? [];
  const rawHeaders = rawHeaderRow.map((h) => String(h ?? "").trim()).filter(Boolean);

  logInfo(`Detected header row ${headerRowIndex + 1}: ${rawHeaders.slice(0, 6).join(", ")}...`, "parseWorkbook");

  const dataRows = sheetRows.slice(headerRowIndex + 1).filter((row) => {
    if (!Array.isArray(row)) return false;
    return row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "");
  });

  const headers = rawHeaders.map(parseWorkbookNormalizeHeader);
  const creatorIdColIndex = parseWorkbookFindCreatorIdColumnIndex(rawHeaders);

  const rows: ParsedBackstageRow[] = dataRows.map((row, index) => {
    const normalized: ParsedBackstageRow = {
      _rowIndex: headerRowIndex + index + 2,
      _sourceSheet: sheetName,
    };
    rawHeaders.forEach((rawKey, colIndex) => {
      const cell = Array.isArray(row) ? row[colIndex] : null;
      normalized[parseWorkbookNormalizeHeader(rawKey)] = cell ?? null;
    });

    if (creatorIdColIndex >= 0) {
      const preciseId = parseWorkbookReadCreatorIdCell(
        sheet,
        headerRowIndex + index + 2,
        creatorIdColIndex
      );
      if (preciseId) {
        normalized.creator_id = preciseId;
      }
    }

    return normalized;
  });

  const expected =
    reportType === "performance" ? PERFORMANCE_EXPECTED_COLUMNS : MANAGEMENT_EXPECTED_COLUMNS;

  let missingColumns = expected.filter(
    (col) => !parseWorkbookHeaderMatchesExpected(headers, col)
  );

  let performanceColumnMap: ParseWorkbookPerformanceColumnMap | undefined;

  if (reportType === "performance") {
    performanceColumnMap = parseWorkbookPerformanceColumnsRemapRows(rows, headers, rawHeaders);
    const missingCritical = parseWorkbookPerformanceColumnsMissingCriticalFields(performanceColumnMap);
    for (const criticalField of missingCritical) {
      if (!missingColumns.includes(criticalField)) {
        missingColumns.push(criticalField);
      }
    }
    for (const resolvedField of ["total_diamonds", "live_duration", "valid_go_live_days"] as const) {
      if (
        performanceColumnMap[resolvedField] &&
        missingColumns.includes(resolvedField)
      ) {
        missingColumns = missingColumns.filter((column) => column !== resolvedField);
      }
    }
  }

  if (missingColumns.length > 0) {
    logDebug(`Column match notes (${reportType}): missing ${missingColumns.join(", ")}`, "parseWorkbook");
    logDebug(`Parsed headers: ${headers.join(", ")}`, "parseWorkbook");
  }

  return { rows, headers, missingColumns, rawHeaders, performanceColumnMap };
}

// MARK: - Core Column Check

export function parseWorkbookHasCreatorIdentifier(headers: string[]): boolean {
  return (
    parseWorkbookHeaderMatchesExpected(headers, "creator_id") ||
    parseWorkbookHeaderMatchesExpected(headers, "creator")
  );
}

// Suggestions For Features and Additions Later:
// - Multi-sheet support if Backstage adds tabs
