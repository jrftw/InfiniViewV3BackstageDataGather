/**
 * Filename: gathererSnapshotHistoryArchivePriorChain.ts
 * Purpose: Resolve daily snapshot delta priors from consecutive Drive archive cumulatives during
 *          batch import, falling back to Mongo only when the prior calendar day is missing from the
 *          batch. Fixes stale daily rows when Mongo-held priors disagree with archive files.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-08-08
 * Dependencies: gathererCreatorDailySnapshot types, gathererSnapshotDeltaEngine, mergeBackstageReports
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import {
  GathererSnapshotCumulativeMetrics,
} from "../types/gathererCreatorDailySnapshot";
import { gathererSnapshotDeltaEnginePriorDateKey } from "./gathererSnapshotDeltaEngine";

// MARK: Types

export interface GathererSnapshotHistoryArchiveChainEntry {
  metrics: GathererSnapshotCumulativeMetrics;
  snapshotDate: string;
}

/** Latest processed archive cumulative per creator within the current import batch. */
export type GathererSnapshotHistoryArchiveChain = Map<string, GathererSnapshotHistoryArchiveChainEntry>;

export type GathererSnapshotHistoryArchivePriorSource = "archive_chain" | "mongo" | "none";

export interface GathererSnapshotHistoryResolvedArchivePrior {
  prior: GathererSnapshotCumulativeMetrics | null;
  priorSnapshotDate: string | null;
  priorSource: GathererSnapshotHistoryArchivePriorSource;
}

export interface GathererSnapshotHistoryMongoPriorLookup {
  metrics: GathererSnapshotCumulativeMetrics;
  priorSnapshotDate: string;
}

// MARK: Prior Resolution

/**
 * Prefer the in-batch archive cumulative when it is exactly the calendar day before `snapshotDate`.
 * Otherwise fall back to Mongo (covers month boundaries and missing archive folders).
 */
export function gathererSnapshotHistoryArchivePriorChainResolvePrior(input: {
  creatorId: string;
  snapshotDate: string;
  archiveChain: GathererSnapshotHistoryArchiveChain;
  mongoPrior: GathererSnapshotHistoryMongoPriorLookup | undefined;
}): GathererSnapshotHistoryResolvedArchivePrior {
  const expectedPriorDate = gathererSnapshotDeltaEnginePriorDateKey(input.snapshotDate);
  const chainEntry = input.archiveChain.get(input.creatorId);

  if (chainEntry && chainEntry.snapshotDate === expectedPriorDate) {
    return {
      prior: chainEntry.metrics,
      priorSnapshotDate: chainEntry.snapshotDate,
      priorSource: "archive_chain",
    };
  }

  if (input.mongoPrior) {
    return {
      prior: input.mongoPrior.metrics,
      priorSnapshotDate: input.mongoPrior.priorSnapshotDate,
      priorSource: "mongo",
    };
  }

  return {
    prior: null,
    priorSnapshotDate: null,
    priorSource: "none",
  };
}

// MARK: Chain Updates

export function gathererSnapshotHistoryArchivePriorChainRecordArchiveCumulatives(input: {
  archiveChain: GathererSnapshotHistoryArchiveChain;
  snapshotDate: string;
  cumulativeByCreator: Map<string, GathererSnapshotCumulativeMetrics>;
}): void {
  for (const [creatorId, metrics] of input.cumulativeByCreator.entries()) {
    input.archiveChain.set(creatorId, {
      metrics,
      snapshotDate: input.snapshotDate,
    });
  }
}

export function gathererSnapshotHistoryArchivePriorChainExtractCumulative(
  creator: CombinedCreatorRecord
): GathererSnapshotCumulativeMetrics {
  return {
    diamonds: typeof creator.total_diamonds === "number" ? creator.total_diamonds : null,
    liveHours:
      typeof creator.live_duration_total_hours === "number"
        ? creator.live_duration_total_hours
        : null,
    validDays:
      typeof creator.valid_live_days_total === "number" ? creator.valid_live_days_total : null,
  };
}

// Suggestions For Features and Additions Later:
// - When chain and mongo priors disagree on consecutive days, emit a reconciliation warning row
// - Support cross-month chain when backfill processes trailing prior-month archive day first
