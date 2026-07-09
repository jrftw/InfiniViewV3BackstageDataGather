/**
 * Filename: runSnapshotHistoryVerifyJob.ts
 * Purpose: CLI QA gate — verify month totals match sum of daily snapshot contributions.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: config, gathererSnapshotHistoryVerifyService
 * Platform Compatibility: Node.js 18+
 */

import { loadGathererConfig } from "../config";
import { gathererSnapshotHistoryVerifyMonthTotals } from "../snapshotHistory/gathererSnapshotHistoryVerifyService";
import { logError, logInfo } from "../logging/logger";

const GATHERER_RUN_SNAPSHOT_HISTORY_VERIFY_JOB_SOURCE = "runSnapshotHistoryVerifyJob";

// MARK: CLI Args

function gathererRunSnapshotHistoryVerifyJobResolveMonth(argv: string[]): string {
  const monthArg = argv.find((arg) => arg.startsWith("--month="));
  if (monthArg) {
    return monthArg.slice("--month=".length).trim();
  }

  const config = loadGathererConfig();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function gathererRunSnapshotHistoryVerifyJobResolveCreatorId(argv: string[]): string | undefined {
  const creatorArg = argv.find((arg) => arg.startsWith("--creator="));
  return creatorArg ? creatorArg.slice("--creator=".length).trim() : undefined;
}

// MARK: Main

async function gathererRunSnapshotHistoryVerifyJobMain(): Promise<void> {
  const config = loadGathererConfig();
  const argv = process.argv.slice(2);
  const month = gathererRunSnapshotHistoryVerifyJobResolveMonth(argv);
  const creatorId = gathererRunSnapshotHistoryVerifyJobResolveCreatorId(argv);

  const report = await gathererSnapshotHistoryVerifyMonthTotals(config, month, creatorId);

  logInfo("Snapshot month verification report", GATHERER_RUN_SNAPSHOT_HISTORY_VERIFY_JOB_SOURCE, {
    month: report.month,
    creatorsChecked: report.creatorsChecked,
    creatorsMatched: report.creatorsMatched,
    creatorsMismatched: report.creatorsMismatched,
  });

  if (report.creatorsMismatched > 0) {
    const mismatches = report.rows
      .filter((row) => !(row.diamondsMatch && row.liveHoursMatch && row.validDaysMatch))
      .slice(0, 20)
      .map((row) => ({
        creatorId: row.creatorId,
        sumDiamonds: row.sumDailyDiamonds,
        cumulativeDiamonds: row.latestCumulativeDiamonds,
        sumHours: row.sumDailyLiveHours,
        cumulativeHours: row.latestCumulativeLiveHours,
        sumValidDays: row.sumValidLiveDays,
        cumulativeValidDays: row.latestCumulativeValidDays,
      }));

    console.log(JSON.stringify({ mismatches, totalMismatched: report.creatorsMismatched }, null, 2));
    process.exitCode = 1;
  }
}

gathererRunSnapshotHistoryVerifyJobMain().catch((error) => {
  logError(
    "Snapshot history verify job crashed",
    GATHERER_RUN_SNAPSHOT_HISTORY_VERIFY_JOB_SOURCE,
    { error: error instanceof Error ? error.message : String(error) }
  );
  process.exitCode = 1;
});

// Suggestions For Features and Additions Later:
// - Write verification JSON artifact to data/logs/
