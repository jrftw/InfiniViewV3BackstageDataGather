/**
 * Filename: gathererMasterSheetSyncMetadataRefresh.test.ts
 * Purpose: Unit tests for master sheet sync-metadata column resolution, A1 column labels, and
 *          post-deletion row-number remapping.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-29
 * Dependencies: masterSheetIncrementalPublish (pure helpers only), sheetDataHelpers, creatorRowChecksum
 * Platform Compatibility: Node.js 18+
 *
 * These tests perform NO I/O — no Google Sheets client is constructed. They lock down two
 * regressions:
 *   1. Rows whose creator data is unchanged must still get their sync-metadata cells refreshed,
 *      which requires the sync columns to resolve to a contiguous range of the live header row.
 *   2. Row numbers cached from the pre-write sheet read must be shifted after row deletions, or
 *      updates land on the wrong creator's row.
 */

import assert from "node:assert/strict";

import {
  MasterSheetRowUpdatePlan,
  masterSheetIncrementalPublishColumnLabel,
  masterSheetIncrementalPublishRemapRowNumbersAfterDeletions,
  masterSheetIncrementalPublishResolveSyncMetadataRuns,
} from "../src/google/masterSheetIncrementalPublish";
import { CombinedCreatorRecord } from "../src/processing/mergeBackstageReports";
import { CREATOR_ROW_CHECKSUM_EXCLUDED_FIELDS } from "../src/processing/creatorRowChecksum";
import { SHEET_DATA_MASTER_CREATOR_COLUMN_ORDER } from "../src/google/sheetDataHelpers";

// MARK: - Test Runner

let masterSheetSyncMetadataTestFailures = 0;

function masterSheetSyncMetadataTestCase(name: string, run: () => void): void {
  try {
    run();
    console.log(`  PASS  ${name}`);
  } catch (error) {
    masterSheetSyncMetadataTestFailures += 1;
    console.error(`  FAIL  ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

function masterSheetSyncMetadataTestPlan(sheetRowNumber: number): MasterSheetRowUpdatePlan {
  return { sheetRowNumber, values: [`row-${sheetRowNumber}`] };
}

// MARK: - A1 Column Labels

console.log("Master sheet sync metadata refresh");

masterSheetSyncMetadataTestCase("column labels cover single and double letter ranges", () => {
  assert.equal(masterSheetIncrementalPublishColumnLabel(0), "A");
  assert.equal(masterSheetIncrementalPublishColumnLabel(1), "B");
  assert.equal(masterSheetIncrementalPublishColumnLabel(25), "Z");
  assert.equal(masterSheetIncrementalPublishColumnLabel(26), "AA");
  assert.equal(masterSheetIncrementalPublishColumnLabel(27), "AB");
  assert.equal(masterSheetIncrementalPublishColumnLabel(51), "AZ");
  assert.equal(masterSheetIncrementalPublishColumnLabel(52), "BA");
  assert.equal(masterSheetIncrementalPublishColumnLabel(701), "ZZ");
  assert.equal(masterSheetIncrementalPublishColumnLabel(702), "AAA");
});

// MARK: - Sync Metadata Column Runs

masterSheetSyncMetadataTestCase(
  "canonical master column order yields exactly one contiguous sync run",
  () => {
    const runs = masterSheetIncrementalPublishResolveSyncMetadataRuns(
      SHEET_DATA_MASTER_CREATOR_COLUMN_ORDER as (keyof CombinedCreatorRecord)[]
    );

    assert.equal(runs.length, 1, `expected one run, got ${JSON.stringify(runs)}`);

    const headers = SHEET_DATA_MASTER_CREATOR_COLUMN_ORDER as string[];
    assert.equal(headers[runs[0].startColumnIndex], "schema_version");
    assert.equal(headers[runs[0].endColumnIndex], "cache_record_version");
    assert.equal(runs[0].endColumnIndex - runs[0].startColumnIndex + 1, 7);
  }
);

masterSheetSyncMetadataTestCase("split sync columns resolve into separate runs", () => {
  const headers = [
    "backstage_creator_id",
    "last_successful_sync_at",
    "total_diamonds",
    "last_sync_status",
    "last_sync_error",
  ] as (keyof CombinedCreatorRecord)[];

  const runs = masterSheetIncrementalPublishResolveSyncMetadataRuns(headers);

  assert.deepEqual(runs, [
    { startColumnIndex: 1, endColumnIndex: 1 },
    { startColumnIndex: 3, endColumnIndex: 4 },
  ]);
});

masterSheetSyncMetadataTestCase("headers with no sync columns yield no runs", () => {
  const headers = [
    "backstage_creator_id",
    "tiktok_username",
    "total_diamonds",
  ] as (keyof CombinedCreatorRecord)[];

  assert.deepEqual(masterSheetIncrementalPublishResolveSyncMetadataRuns(headers), []);
});

masterSheetSyncMetadataTestCase(
  "every refreshed sync column is excluded from row_checksum",
  () => {
    // This is the invariant that makes the refresh necessary: because these columns do not affect
    // the checksum, a data-identical row is skipped and its sync stamp would otherwise freeze.
    const runs = masterSheetIncrementalPublishResolveSyncMetadataRuns(
      SHEET_DATA_MASTER_CREATOR_COLUMN_ORDER as (keyof CombinedCreatorRecord)[]
    );
    const headers = SHEET_DATA_MASTER_CREATOR_COLUMN_ORDER as string[];
    const excluded = new Set<string>(CREATOR_ROW_CHECKSUM_EXCLUDED_FIELDS as readonly string[]);

    for (const run of runs) {
      for (let index = run.startColumnIndex; index <= run.endColumnIndex; index++) {
        assert.ok(
          excluded.has(headers[index]),
          `${headers[index]} is refreshed but is NOT excluded from row_checksum`
        );
      }
    }
  }
);

// MARK: - Post-Deletion Row Remapping

masterSheetSyncMetadataTestCase("no deletions leaves row numbers untouched", () => {
  const plans = [masterSheetSyncMetadataTestPlan(5), masterSheetSyncMetadataTestPlan(9)];
  const remapped = masterSheetIncrementalPublishRemapRowNumbersAfterDeletions(plans, []);

  assert.deepEqual(
    remapped.map((plan) => plan.sheetRowNumber),
    [5, 9]
  );
});

masterSheetSyncMetadataTestCase("rows above a deletion are unaffected", () => {
  const plans = [masterSheetSyncMetadataTestPlan(3), masterSheetSyncMetadataTestPlan(4)];
  const remapped = masterSheetIncrementalPublishRemapRowNumbersAfterDeletions(plans, [10]);

  assert.deepEqual(
    remapped.map((plan) => plan.sheetRowNumber),
    [3, 4]
  );
});

masterSheetSyncMetadataTestCase("rows below one deletion shift up by one", () => {
  const plans = [masterSheetSyncMetadataTestPlan(11), masterSheetSyncMetadataTestPlan(50)];
  const remapped = masterSheetIncrementalPublishRemapRowNumbersAfterDeletions(plans, [10]);

  assert.deepEqual(
    remapped.map((plan) => plan.sheetRowNumber),
    [10, 49]
  );
});

masterSheetSyncMetadataTestCase("multiple deletions accumulate per row", () => {
  const plans = [
    masterSheetSyncMetadataTestPlan(5),
    masterSheetSyncMetadataTestPlan(15),
    masterSheetSyncMetadataTestPlan(25),
    masterSheetSyncMetadataTestPlan(35),
  ];
  // Deliberately unsorted input to prove the helper sorts internally.
  const remapped = masterSheetIncrementalPublishRemapRowNumbersAfterDeletions(
    plans,
    [30, 10, 20]
  );

  assert.deepEqual(
    remapped.map((plan) => plan.sheetRowNumber),
    [5, 14, 23, 32]
  );
});

masterSheetSyncMetadataTestCase("row values are carried through remapping unchanged", () => {
  const plans: MasterSheetRowUpdatePlan[] = [
    { sheetRowNumber: 20, values: ["a", "b", "c"] },
  ];
  const remapped = masterSheetIncrementalPublishRemapRowNumbersAfterDeletions(plans, [2, 4]);

  assert.equal(remapped[0].sheetRowNumber, 18);
  assert.deepEqual(remapped[0].values, ["a", "b", "c"]);
});

masterSheetSyncMetadataTestCase("empty plan list is handled", () => {
  assert.deepEqual(masterSheetIncrementalPublishRemapRowNumbersAfterDeletions([], [3, 4]), []);
});

// MARK: - Summary

if (masterSheetSyncMetadataTestFailures > 0) {
  console.error(
    `\n${masterSheetSyncMetadataTestFailures} master sheet sync metadata test(s) failed.`
  );
  process.exit(1);
}

console.log("\nAll master sheet sync metadata tests passed.");

// Suggestions For Features and Additions Later:
// - Add a fake Sheets client to assert the exact batchUpdate ranges emitted per chunk.
