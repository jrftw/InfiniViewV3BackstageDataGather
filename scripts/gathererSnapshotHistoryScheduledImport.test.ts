/**
 * Filename: gathererSnapshotHistoryScheduledImport.test.ts
 * Purpose: Unit tests for Phase 2 scheduled snapshot import (open-month re-derive scope).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-08-08
 * Platform Compatibility: Node.js 18+
 */

import assert from "node:assert/strict";
import {
  gathererRunSnapshotHistoryImportJobCurrentMonthKey,
  gathererRunSnapshotHistoryImportJobYesterdayDateKey,
} from "../src/jobs/runSnapshotHistoryImportJob";
import { gathererSnapshotHistoryFilterEntriesForScheduledRederive } from "../src/snapshotHistory/gathererSnapshotHistoryImportService";

// MARK: Helpers

function gathererSnapshotHistoryScheduledImportTestEntry(snapshotDate: string) {
  return {
    snapshotDate,
    dateFolderId: "folder",
    spreadsheetId: "sheet",
    spreadsheetTitle: `InfiniView Creators ${snapshotDate}`,
    sourceFileName: `InfiniView Creators ${snapshotDate}`,
  };
}

// MARK: Tests

function gathererSnapshotHistoryScheduledImportTestOpenMonthScope(): void {
  const entries = [
    gathererSnapshotHistoryScheduledImportTestEntry("2026-07-31"),
    gathererSnapshotHistoryScheduledImportTestEntry("2026-08-02"),
    gathererSnapshotHistoryScheduledImportTestEntry("2026-08-06"),
    gathererSnapshotHistoryScheduledImportTestEntry("2026-08-07"),
    gathererSnapshotHistoryScheduledImportTestEntry("2026-08-08"),
  ];

  const filtered = gathererSnapshotHistoryFilterEntriesForScheduledRederive(entries, {
    rederiveMonthKey: "2026-08",
    importThroughDate: "2026-08-07",
  });

  assert.deepEqual(
    filtered.map((entry) => entry.snapshotDate),
    ["2026-08-02", "2026-08-06", "2026-08-07"]
  );
}

function gathererSnapshotHistoryScheduledImportTestMonthRolloverIncludesYesterday(): void {
  const entries = [
    gathererSnapshotHistoryScheduledImportTestEntry("2026-08-30"),
    gathererSnapshotHistoryScheduledImportTestEntry("2026-08-31"),
    gathererSnapshotHistoryScheduledImportTestEntry("2026-09-01"),
  ];

  const filtered = gathererSnapshotHistoryFilterEntriesForScheduledRederive(entries, {
    rederiveMonthKey: "2026-09",
    importThroughDate: "2026-08-31",
  });

  assert.deepEqual(filtered.map((entry) => entry.snapshotDate), ["2026-08-31"]);
}

function gathererSnapshotHistoryScheduledImportTestDateHelpers(): void {
  assert.match(gathererRunSnapshotHistoryImportJobCurrentMonthKey("America/New_York"), /^\d{4}-\d{2}$/);
  assert.match(gathererRunSnapshotHistoryImportJobYesterdayDateKey("America/New_York"), /^\d{4}-\d{2}-\d{2}$/);
}

function gathererSnapshotHistoryScheduledImportRunAllTests(): void {
  gathererSnapshotHistoryScheduledImportTestOpenMonthScope();
  gathererSnapshotHistoryScheduledImportTestMonthRolloverIncludesYesterday();
  gathererSnapshotHistoryScheduledImportTestDateHelpers();
  console.log("gathererSnapshotHistoryScheduledImport tests passed");
}

gathererSnapshotHistoryScheduledImportRunAllTests();

// Suggestions For Features and Additions Later:
// - Freeze clock tests for month-boundary yesterday helper
