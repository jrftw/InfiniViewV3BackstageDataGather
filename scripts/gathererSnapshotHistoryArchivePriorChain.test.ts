/**
 * Filename: gathererSnapshotHistoryArchivePriorChain.test.ts
 * Purpose: Unit tests for archive-to-archive prior chaining during snapshot history import.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-08-08
 * Platform Compatibility: Node.js 18+
 */

import assert from "node:assert/strict";
import {
  gathererSnapshotHistoryArchivePriorChainResolvePrior,
  GathererSnapshotHistoryArchiveChain,
} from "../src/snapshotHistory/gathererSnapshotHistoryArchivePriorChain";
import { gathererSnapshotDeltaEngineDeriveDailyMetrics } from "../src/snapshotHistory/gathererSnapshotDeltaEngine";

// MARK: Chain Prior Tests

function gathererSnapshotHistoryArchivePriorChainTestPrefersConsecutiveArchiveDay(): void {
  const archiveChain: GathererSnapshotHistoryArchiveChain = new Map([
    [
      "7637323129831997454",
      {
        snapshotDate: "2026-08-05",
        metrics: { diamonds: 129, liveHours: 5.13, validDays: 3 },
      },
    ],
  ]);

  const resolved = gathererSnapshotHistoryArchivePriorChainResolvePrior({
    creatorId: "7637323129831997454",
    snapshotDate: "2026-08-06",
    archiveChain,
    mongoPrior: {
      priorSnapshotDate: "2026-08-04",
      metrics: { diamonds: 120, liveHours: 4.97, validDays: 2 },
    },
  });

  assert.equal(resolved.priorSource, "archive_chain");
  assert.equal(resolved.priorSnapshotDate, "2026-08-05");
  assert.equal(resolved.prior?.liveHours, 5.13);
}

function gathererSnapshotHistoryArchivePriorChainTestFallsBackToMongoWhenChainGap(): void {
  const archiveChain: GathererSnapshotHistoryArchiveChain = new Map([
    [
      "7637323129831997454",
      {
        snapshotDate: "2026-08-04",
        metrics: { diamonds: 120, liveHours: 4.97, validDays: 2 },
      },
    ],
  ]);

  const resolved = gathererSnapshotHistoryArchivePriorChainResolvePrior({
    creatorId: "7637323129831997454",
    snapshotDate: "2026-08-06",
    archiveChain,
    mongoPrior: {
      priorSnapshotDate: "2026-08-05",
      metrics: { diamonds: 129, liveHours: 5.13, validDays: 3 },
    },
  });

  assert.equal(resolved.priorSource, "mongo");
  assert.equal(resolved.priorSnapshotDate, "2026-08-05");
}

// MARK: Bella Aug 6 Scenario

function gathererSnapshotHistoryArchivePriorChainTestBellaAug6DailyFromArchiveChain(): void {
  const archiveChain: GathererSnapshotHistoryArchiveChain = new Map([
    [
      "7637323129831997454",
      {
        snapshotDate: "2026-08-05",
        metrics: { diamonds: 129, liveHours: 5.13, validDays: 3 },
      },
    ],
  ]);

  const resolved = gathererSnapshotHistoryArchivePriorChainResolvePrior({
    creatorId: "7637323129831997454",
    snapshotDate: "2026-08-06",
    archiveChain,
    mongoPrior: undefined,
  });

  const derived = gathererSnapshotDeltaEngineDeriveDailyMetrics({
    snapshotDate: "2026-08-06",
    current: { diamonds: 132, liveHours: 6.35, validDays: 4 },
    prior: resolved.prior,
    priorSnapshotDate: resolved.priorSnapshotDate,
  });

  assert.equal(resolved.priorSource, "archive_chain");
  assert.equal(Math.round((derived.liveHours ?? 0) * 100), 122);
  assert.equal(derived.validLiveDay, true);
}

function gathererSnapshotHistoryArchivePriorChainRunAllTests(): void {
  gathererSnapshotHistoryArchivePriorChainTestPrefersConsecutiveArchiveDay();
  gathererSnapshotHistoryArchivePriorChainTestFallsBackToMongoWhenChainGap();
  gathererSnapshotHistoryArchivePriorChainTestBellaAug6DailyFromArchiveChain();
  console.log("gathererSnapshotHistoryArchivePriorChain tests passed");
}

gathererSnapshotHistoryArchivePriorChainRunAllTests();

// Suggestions For Features and Additions Later:
// - Move to node:test runner alongside gathererSnapshotDeltaEngine tests
