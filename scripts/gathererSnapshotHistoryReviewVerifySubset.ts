/**
 * Filename: gathererSnapshotHistoryReviewVerifySubset.ts
 * Purpose: Review helper — verify matched vs mismatched creators for July 2026.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: config, gathererSnapshotHistoryVerifyService
 * Platform Compatibility: Node.js 18+
 */

import { loadGathererConfig } from "../src/config";
import {
  gathererSnapshotHistoryListImportedDatesForMonth,
  gathererSnapshotHistoryVerifyMonthTotals,
} from "../src/snapshotHistory/gathererSnapshotHistoryVerifyService";

// MARK: Main

async function gathererSnapshotHistoryReviewVerifySubsetMain(): Promise<void> {
  const config = loadGathererConfig();
  const month = "2026-07";
  const report = await gathererSnapshotHistoryVerifyMonthTotals(config, month);
  const importedDates = await gathererSnapshotHistoryListImportedDatesForMonth(config, month);

  const matched = report.rows.filter(
    (row) => row.diamondsMatch && row.liveHoursMatch && row.validDaysMatch
  );
  const mismatched = report.rows.filter(
    (row) => !(row.diamondsMatch && row.liveHoursMatch && row.validDaysMatch)
  );

  const fullCoverageMatched = matched.filter((row) => row.snapshotDayCount === importedDates.length);
  const fullCoverageMismatched = mismatched.filter(
    (row) => row.snapshotDayCount === importedDates.length
  );

  console.log(
    JSON.stringify(
      {
        month,
        importedDates,
        importedDayCount: importedDates.length,
        creatorsChecked: report.creatorsChecked,
        creatorsMatched: report.creatorsMatched,
        creatorsMismatched: report.creatorsMismatched,
        fullCoverageMatchedCount: fullCoverageMatched.length,
        fullCoverageMismatchedCount: fullCoverageMismatched.length,
        sampleMatched: matched.slice(0, 3),
        sampleMismatched: mismatched.slice(0, 5),
        sampleFullCoverageMismatched: fullCoverageMismatched.slice(0, 5),
      },
      null,
      2
    )
  );
}

gathererSnapshotHistoryReviewVerifySubsetMain().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Suggestions For Features and Additions Later:
// - Remove after Priority 1 sign-off
