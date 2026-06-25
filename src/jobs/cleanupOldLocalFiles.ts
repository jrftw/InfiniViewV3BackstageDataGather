/**
 * Filename: cleanupOldLocalFiles.ts
 * Purpose: Remove local files older than KEEP_LOCAL_FILES_DAYS.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import path from "path";
import { GathererConfig } from "../config";
import { logInfo } from "../logging/logger";

// MARK: - Cleanup

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

  return removed;
}

// Suggestions For Features and Additions Later:
// - Archive instead of delete
