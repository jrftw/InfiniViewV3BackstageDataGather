/**
 * Filename: cleanupOldLocalFiles.ts
 * Purpose: Remove old local files and trim excess raw export pairs per day.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-25
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import path from "path";
import { GathererConfig } from "../config";
import { logInfo } from "../logging/logger";

// MARK: - Age Cleanup

export function cleanupOldLocalGathererFiles(config: GathererConfig): number {
  const dirs = [config.localRawDir, config.localProcessedDir, config.localDownloadDir];
  const maxAgeMs = config.keepLocalFilesDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let removed = 0;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      if (!fs.statSync(fullPath).isFile()) continue;

      const age = now - fs.statSync(fullPath).mtimeMs;
      if (age > maxAgeMs) {
        fs.unlinkSync(fullPath);
        removed++;
      }
    }
  }

  if (removed > 0) {
    logInfo(`Cleaned up ${removed} old local files`, "cleanupOldLocalFiles");
  }

  const trimmedPairs = gathererTrimExcessRawExportPairs(config);
  return removed + trimmedPairs;
}

// MARK: - Raw Pair Trim

function gathererExtractRawExportDateKey(fileName: string): string | null {
  const match = fileName.match(
    /^backstage-(?:performance|management)-(\d{4}-\d{2}-\d{2})-\d{4}\.xlsx$/i
  );
  return match?.[1] ?? null;
}

function gathererExtractRawExportSortKey(fileName: string): string {
  const match = fileName.match(
    /^backstage-(?:performance|management)-(\d{4}-\d{2}-\d{2})-(\d{4})\.xlsx$/i
  );
  if (!match) {
    return fileName;
  }
  return `${match[1]}-${match[2]}`;
}

function gathererTrimExcessRawExportPairs(config: GathererConfig): number {
  const keepPairs = config.gathererKeepRawPairsPerDay;
  if (keepPairs <= 0 || !fs.existsSync(config.localRawDir)) {
    return 0;
  }

  const files = fs
    .readdirSync(config.localRawDir)
    .filter((entry) => entry.toLowerCase().endsWith(".xlsx"));

  const filesByDate = new Map<string, string[]>();
  for (const fileName of files) {
    const dateKey = gathererExtractRawExportDateKey(fileName);
    if (!dateKey) continue;
    const bucket = filesByDate.get(dateKey) ?? [];
    bucket.push(fileName);
    filesByDate.set(dateKey, bucket);
  }

  let removed = 0;
  for (const [, dayFiles] of filesByDate) {
    const sorted = [...dayFiles].sort((left, right) =>
      gathererExtractRawExportSortKey(right).localeCompare(
        gathererExtractRawExportSortKey(left)
      )
    );
    const excess = sorted.slice(keepPairs * 2);
    for (const fileName of excess) {
      fs.unlinkSync(path.join(config.localRawDir, fileName));
      removed++;
    }
  }

  if (removed > 0) {
    logInfo(
      `Trimmed ${removed} excess raw export files (keeping ${keepPairs} pairs per day)`,
      "cleanupOldLocalFiles"
    );
  }

  return removed;
}

// Suggestions For Features and Additions Later:
// - Archive instead of delete
