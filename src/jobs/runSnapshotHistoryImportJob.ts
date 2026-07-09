/**
 * Filename: runSnapshotHistoryImportJob.ts
 * Purpose: CLI entry for Priority 1 Daily Snapshot History Engine import.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: config, gathererSnapshotHistoryImportService
 * Platform Compatibility: Node.js 18+
 */

import { loadGathererConfig } from "../config";
import { gathererSnapshotHistoryRunImport } from "../snapshotHistory/gathererSnapshotHistoryImportService";
import { logError, logInfo } from "../logging/logger";

const GATHERER_RUN_SNAPSHOT_HISTORY_IMPORT_JOB_SOURCE = "runSnapshotHistoryImportJob";

// MARK: CLI Args

function gathererRunSnapshotHistoryImportJobParseArgs(argv: string[]): {
  trigger: "scheduled" | "backfill" | "manual";
  snapshotDate?: string;
  skipExistingDates: boolean;
  forceReimport: boolean;
} {
  let trigger: "scheduled" | "backfill" | "manual" = "manual";
  let snapshotDate: string | undefined;
  let skipExistingDates = false;
  let forceReimport = false;

  for (const arg of argv) {
    if (arg === "--backfill") {
      trigger = "backfill";
      skipExistingDates = true;
    } else if (arg === "--scheduled") {
      trigger = "scheduled";
    } else if (arg === "--force-reimport") {
      forceReimport = true;
      skipExistingDates = false;
    } else if (arg.startsWith("--date=")) {
      snapshotDate = arg.slice("--date=".length).trim();
    } else if (arg === "--skip-existing") {
      skipExistingDates = true;
    }
  }

  if (trigger === "scheduled" && !snapshotDate) {
    const config = loadGathererConfig();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: config.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const read = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value ?? "01";
    snapshotDate = `${read("year")}-${read("month")}-${read("day")}`;
  }

  return { trigger, snapshotDate, skipExistingDates, forceReimport };
}

// MARK: Main

export async function runSnapshotHistoryImportJob(argv: string[] = process.argv.slice(2)): Promise<number> {
  const config = loadGathererConfig();
  const args = gathererRunSnapshotHistoryImportJobParseArgs(argv);

  logInfo("Snapshot history import job starting", GATHERER_RUN_SNAPSHOT_HISTORY_IMPORT_JOB_SOURCE, args);

  const result = await gathererSnapshotHistoryRunImport(config, {
    trigger: args.trigger,
    snapshotDate: args.snapshotDate,
    skipExistingDates: args.skipExistingDates,
    forceReimport: args.forceReimport || !args.skipExistingDates,
  });

  logInfo("Snapshot history import job finished", GATHERER_RUN_SNAPSHOT_HISTORY_IMPORT_JOB_SOURCE, {
    importRunId: result.importRunId,
    success: result.success,
    filesScanned: result.filesScanned,
    filesImported: result.filesImported,
    snapshotsUpserted: result.snapshotsUpserted,
    snapshotsSkipped: result.snapshotsSkipped,
    errorCount: result.errors.length,
  });

  return result.success ? 0 : 1;
}

async function gathererRunSnapshotHistoryImportJobMain(): Promise<void> {
  const exitCode = await runSnapshotHistoryImportJob(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

gathererRunSnapshotHistoryImportJobMain().catch((error) => {
  logError(
    "Snapshot history import job crashed",
    GATHERER_RUN_SNAPSHOT_HISTORY_IMPORT_JOB_SOURCE,
    { error: error instanceof Error ? error.message : String(error) }
  );
  process.exitCode = 1;
});

// Suggestions For Features and Additions Later:
// - --verify flag to run month verification immediately after import
