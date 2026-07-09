/**
 * Filename: gathererSnapshotHistoryReviewDriveDates.ts
 * Purpose: One-off review helper — list Drive archive dates and July gaps.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: config, gathererSnapshotHistoryDriveScanner
 * Platform Compatibility: Node.js 18+
 */

import { loadGathererConfig } from "../src/config";
import { gathererSnapshotHistoryListArchiveEntries } from "../src/snapshotHistory/gathererSnapshotHistoryDriveScanner";

// MARK: Main

async function gathererSnapshotHistoryReviewDriveDatesMain(): Promise<void> {
  const config = loadGathererConfig();
  const entries = await gathererSnapshotHistoryListArchiveEntries(config);
  const allDates = entries.map((entry) => entry.snapshotDate);
  const julyDatesInDrive = allDates.filter((date) => date.startsWith("2026-07"));

  const missingJulyDates: string[] = [];
  for (let day = 1; day <= 9; day += 1) {
    const dateKey = `2026-07-${String(day).padStart(2, "0")}`;
    if (!allDates.includes(dateKey)) {
      missingJulyDates.push(dateKey);
    }
  }

  console.log(
    JSON.stringify(
      {
        archiveFolderId: config.googleDriveDailyArchiveFolderId,
        totalArchiveFiles: entries.length,
        allDates,
        julyDatesInDrive,
        missingJulyDates,
      },
      null,
      2
    )
  );
}

gathererSnapshotHistoryReviewDriveDatesMain().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Suggestions For Features and Additions Later:
// - Remove after Priority 1 sign-off or fold into verify CLI
