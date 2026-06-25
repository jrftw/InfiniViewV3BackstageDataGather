/**
 * Filename: normalizeManagementDateRange.ts
 * Purpose: Split Backstage management date ranges into start/end YYYY-MM-DD values.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Types

export interface NormalizedManagementDateRange {
  startDate: string | null;
  endDate: string | null;
}

// MARK: - Date Part Parser

function normalizeManagementDateRangeParsePart(rawPart: string): string | null {
  const part = String(rawPart ?? "").trim();
  if (!part) {
    return null;
  }

  const match = part.match(/(\d{4})[:/-](\d{1,2})[:/-](\d{1,2})/);
  if (!match) {
    return null;
  }

  const year = match[1];
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// MARK: - Range Parser

/**
 * Parses values like "2023:08:05 ~ 2027:08:04 (UTC+0)" into ISO-style dates.
 */
export function normalizeBackstageManagementDateRange(
  raw: string | null | undefined
): NormalizedManagementDateRange {
  if (raw === null || raw === undefined) {
    return { startDate: null, endDate: null };
  }

  const text = String(raw).trim();
  if (!text || text === "-") {
    return { startDate: null, endDate: null };
  }

  const parts = text.split("~").map((part) => part.trim());
  const startDate = normalizeManagementDateRangeParsePart(parts[0] ?? "");
  const endDate = parts.length > 1 ? normalizeManagementDateRangeParsePart(parts[1]) : null;

  if (startDate && !endDate && !text.includes("~")) {
    return { startDate, endDate: null };
  }

  return { startDate, endDate };
}

// Suggestions For Features and Additions Later:
// - Support open-ended ranges with only a start date before ~
