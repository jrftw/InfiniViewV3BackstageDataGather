/**
 * Filename: gathererSnapshotDeltaEngine.test.ts
 * Purpose: Unit tests for daily delta derivation (Priority 1 snapshot history engine).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Platform Compatibility: Node.js 18+
 */

import assert from "node:assert/strict";
import {
  gathererSnapshotDeltaEngineDeriveDailyMetrics,
  gathererSnapshotDeltaEngineNumbersMatch,
} from "../src/snapshotHistory/gathererSnapshotDeltaEngine";

// MARK: Tests

function gathererSnapshotDeltaEngineTestMonthStart(): void {
  const derived = gathererSnapshotDeltaEngineDeriveDailyMetrics({
    snapshotDate: "2026-07-01",
    current: { diamonds: 50_000, liveHours: 2.5, validDays: 1 },
    prior: { diamonds: 900_000, liveHours: 80, validDays: 20 },
  });

  assert.equal(derived.diamonds, 50_000);
  assert.equal(derived.liveHours, 2.5);
  assert.equal(derived.validLiveDay, true);
  assert.equal(derived.dataStatus, "complete");
}

function gathererSnapshotDeltaEngineTestDailyDelta(): void {
  const derived = gathererSnapshotDeltaEngineDeriveDailyMetrics({
    snapshotDate: "2026-07-09",
    current: { diamonds: 820_000, liveHours: 31.4, validDays: 8 },
    prior: { diamonds: 754_000, liveHours: 28.85, validDays: 7 },
  });

  assert.equal(derived.diamonds, 66_000);
  assert.equal(Math.round(derived.liveHours! * 100), 255);
  assert.equal(derived.validLiveDay, true);
}

function gathererSnapshotDeltaEngineTestValidDayFromHours(): void {
  const derived = gathererSnapshotDeltaEngineDeriveDailyMetrics({
    snapshotDate: "2026-07-10",
    current: { diamonds: 830_000, liveHours: 32.5, validDays: 8 },
    prior: { diamonds: 820_000, liveHours: 31.4, validDays: 8 },
  });

  assert.equal(derived.validLiveDay, true);
  assert.equal(derived.liveDays, 1);
}

function gathererSnapshotDeltaEngineTestVerificationTolerance(): void {
  assert.equal(gathererSnapshotDeltaEngineNumbersMatch(754_000, 754_000.5, 1.5), true);
  assert.equal(gathererSnapshotDeltaEngineNumbersMatch(754_000, 756_000, 1.5), false);
}

function gathererSnapshotDeltaEngineTestSkipsNullPriorMetrics(): void {
  const derived = gathererSnapshotDeltaEngineDeriveDailyMetrics({
    snapshotDate: "2026-07-07",
    current: { diamonds: 136_816, liveHours: 4.16, validDays: 2 },
    prior: { diamonds: null, liveHours: null, validDays: null },
    priorSnapshotDate: "2026-07-06",
  });

  assert.equal(derived.diamonds, 136_816);
  assert.equal(derived.liveHours, 4.16);
  assert.equal(derived.validLiveDay, true);
  assert.equal(derived.dataStatus, "partial");
  assert.equal(derived.dataStatusNote, "MTD_THROUGH_DATE_NOT_SINGLE_DAY");
}

function gathererSnapshotDeltaEngineRunAllTests(): void {
  gathererSnapshotDeltaEngineTestMonthStart();
  gathererSnapshotDeltaEngineTestDailyDelta();
  gathererSnapshotDeltaEngineTestValidDayFromHours();
  gathererSnapshotDeltaEngineTestSkipsNullPriorMetrics();
  gathererSnapshotDeltaEngineTestVerificationTolerance();
  console.log("gathererSnapshotDeltaEngine tests passed");
}

gathererSnapshotDeltaEngineRunAllTests();

// Suggestions For Features and Additions Later:
// - Move to formal test runner (node:test)
