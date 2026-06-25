/**
 * Filename: runState.ts
 * Purpose: Shared run lock and last-run status for scheduler and API.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import path from "path";
import { ImportSummaryData } from "../logging/importSummary";
import { gathererEnsureDir, gathererWriteJsonFile, gathererReadJsonFile } from "../utils/files";

// MARK: - Run State

export interface GathererRunState {
  isRunning: boolean;
  lastSummary: ImportSummaryData | null;
  lastError: string | null;
}

let gathererRunLock = false;
let gathererLastSummary: ImportSummaryData | null = null;
let gathererLastError: string | null = null;

const LAST_SUMMARY_FILE = "data/logs/last-run-summary.json";

// MARK: - Lock API

export function acquireGathererRunLock(): boolean {
  if (gathererRunLock) {
    return false;
  }
  gathererRunLock = true;
  return true;
}

export function releaseGathererRunLock(): void {
  gathererRunLock = false;
}

export function getGathererRunState(): GathererRunState {
  if (!gathererLastSummary) {
    gathererLastSummary = gathererReadJsonFile<ImportSummaryData>(
      path.resolve(LAST_SUMMARY_FILE)
    );
  }
  return {
    isRunning: gathererRunLock,
    lastSummary: gathererLastSummary,
    lastError: gathererLastError,
  };
}

export function setGathererLastSummary(summary: ImportSummaryData): void {
  gathererLastSummary = summary;
  gathererLastError = summary.success ? null : summary.errors.join("; ");
  gathererEnsureDir(path.dirname(path.resolve(LAST_SUMMARY_FILE)));
  gathererWriteJsonFile(path.resolve(LAST_SUMMARY_FILE), summary);
}

// Suggestions For Features and Additions Later:
// - File-based lock for multi-process safety
