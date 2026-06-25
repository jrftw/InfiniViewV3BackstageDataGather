/**
 * Filename: findLatestRawExports.ts
 * Purpose: Locate the newest paired Backstage raw export files in data/raw for reprocessing.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import path from "path";

// MARK: - Types

export interface GathererLatestRawExportPair {
  performanceFile: string;
  managementFile: string;
  exportTimestampKey: string;
}

// MARK: - Helpers

const FIND_LATEST_RAW_EXPORTS_TIMESTAMP_PATTERN =
  /backstage-(?:performance|management)-(\d{4}-\d{2}-\d{2}-\d{4})\.xlsx$/i;

function findLatestRawExportsListMatchingFiles(
  rawDir: string,
  prefix: "backstage-performance-" | "backstage-management-"
): Array<{ filePath: string; timestampKey: string; mtimeMs: number }> {
  if (!fs.existsSync(rawDir)) {
    return [];
  }

  return fs
    .readdirSync(rawDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".xlsx"))
    .map((name) => {
      const match = name.match(FIND_LATEST_RAW_EXPORTS_TIMESTAMP_PATTERN);
      const filePath = path.join(rawDir, name);
      return {
        filePath,
        timestampKey: match?.[1] ?? name,
        mtimeMs: fs.statSync(filePath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

// MARK: - Public Finder

/**
 * Returns the newest management export and its matching performance export (same export timestamp).
 */
export function findLatestGathererRawExportPair(rawDir: string): GathererLatestRawExportPair | null {
  const managementCandidates = findLatestRawExportsListMatchingFiles(
    rawDir,
    "backstage-management-"
  );

  if (managementCandidates.length === 0) {
    return null;
  }

  const performanceByKey = new Map(
    findLatestRawExportsListMatchingFiles(rawDir, "backstage-performance-").map((entry) => [
      entry.timestampKey,
      entry.filePath,
    ])
  );

  for (const managementEntry of managementCandidates) {
    const performanceFile = performanceByKey.get(managementEntry.timestampKey);
    if (performanceFile) {
      return {
        performanceFile,
        managementFile: managementEntry.filePath,
        exportTimestampKey: managementEntry.timestampKey,
      };
    }
  }

  return null;
}

// Suggestions For Features and Additions Later:
// - Accept explicit timestamp key via CLI flag
