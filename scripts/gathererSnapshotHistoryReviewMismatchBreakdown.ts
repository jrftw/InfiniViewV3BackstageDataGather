/**
 * Filename: gathererSnapshotHistoryReviewMismatchBreakdown.ts
 * Purpose: Break down July verify mismatches by metric type.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: config, gathererSnapshotHistoryVerifyService
 * Platform Compatibility: Node.js 18+
 */

import { loadGathererConfig } from "../src/config";
import { gathererSnapshotHistoryVerifyMonthTotals } from "../src/snapshotHistory/gathererSnapshotHistoryVerifyService";

// MARK: Main

async function gathererSnapshotHistoryReviewMismatchBreakdownMain(): Promise<void> {
  const config = loadGathererConfig();
  const report = await gathererSnapshotHistoryVerifyMonthTotals(config, "2026-07");

  const mismatched = report.rows.filter(
    (row) => !(row.diamondsMatch && row.liveHoursMatch && row.validDaysMatch)
  );

  const diamondsHoursOnly = mismatched.filter(
    (row) => row.diamondsMatch && row.liveHoursMatch && !row.validDaysMatch
  );
  const diamondsOnly = mismatched.filter(
    (row) => !row.diamondsMatch && row.liveHoursMatch && row.validDaysMatch
  );
  const hoursOnly = mismatched.filter(
    (row) => row.diamondsMatch && !row.liveHoursMatch && row.validDaysMatch
  );
  const allThree = mismatched.filter(
    (row) => !row.diamondsMatch && !row.liveHoursMatch && !row.validDaysMatch
  );

  console.log(
    JSON.stringify(
      {
        creatorsChecked: report.creatorsChecked,
        creatorsMatched: report.creatorsMatched,
        creatorsMismatched: report.creatorsMismatched,
        mismatchBreakdown: {
          diamondsAndHoursMatchValidDaysOff: diamondsHoursOnly.length,
          diamondsOnlyOff: diamondsOnly.length,
          hoursOnlyOff: hoursOnly.length,
          allThreeOff: allThree.length,
        },
        sampleValidDaysOnly: diamondsHoursOnly.slice(0, 5),
      },
      null,
      2
    )
  );
}

gathererSnapshotHistoryReviewMismatchBreakdownMain().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Suggestions For Features and Additions Later:
// - Remove after Priority 1 sign-off
