/**
 * Filename: gathererPerformanceDataPeriodCoverage.test.ts
 * Purpose: Unit tests for performance_data_period month coverage used by the roster MTD rollover gate.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-08-08
 * Platform Compatibility: Node.js 18+
 */

import assert from "node:assert/strict";
import { gathererPerformanceDataPeriodCoversMonth } from "../src/processing/gathererPerformanceDataPeriodCoverage";

// MARK: Coverage Tests

function gathererPerformanceDataPeriodCoverageTestMatchesCurrentMonthPrefix(): void {
  assert.equal(
    gathererPerformanceDataPeriodCoversMonth("2026-08-01 ~ 2026-08-07", "2026-08"),
    true
  );
}

function gathererPerformanceDataPeriodCoverageTestRejectsPriorMonthPeriod(): void {
  assert.equal(
    gathererPerformanceDataPeriodCoversMonth("2026-07-01 ~ 2026-07-31", "2026-08"),
    false
  );
}

function gathererPerformanceDataPeriodCoverageTestRejectsEmptyPeriod(): void {
  assert.equal(gathererPerformanceDataPeriodCoversMonth(null, "2026-08"), false);
  assert.equal(gathererPerformanceDataPeriodCoversMonth("", "2026-08"), false);
}

function gathererPerformanceDataPeriodCoverageTestRejectsInvalidMonthKey(): void {
  assert.equal(
    gathererPerformanceDataPeriodCoversMonth("2026-08-01 ~ 2026-08-07", "2026-8"),
    false
  );
}

function gathererPerformanceDataPeriodCoverageTestTrimsWhitespace(): void {
  assert.equal(
    gathererPerformanceDataPeriodCoversMonth("  2026-08-01 ~ 2026-08-07  ", "2026-08"),
    true
  );
}

// MARK: Runner

function gathererPerformanceDataPeriodCoverageRunAllTests(): void {
  gathererPerformanceDataPeriodCoverageTestMatchesCurrentMonthPrefix();
  gathererPerformanceDataPeriodCoverageTestRejectsPriorMonthPeriod();
  gathererPerformanceDataPeriodCoverageTestRejectsEmptyPeriod();
  gathererPerformanceDataPeriodCoverageTestRejectsInvalidMonthKey();
  gathererPerformanceDataPeriodCoverageTestTrimsWhitespace();
  console.log("gathererPerformanceDataPeriodCoverage.test.ts — all tests passed");
}

gathererPerformanceDataPeriodCoverageRunAllTests();

// Suggestions For Features and Additions Later:
// - Parse explicit end date to detect partial-month periods that span month boundaries
