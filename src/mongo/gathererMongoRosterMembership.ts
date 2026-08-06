/**
 * Filename: gathererMongoRosterMembership.ts
 * Purpose: Stamp active creators and tombstone departed creators in the MongoDB creators collection.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-08-05
 * Dependencies: mongodb, config, logger, gathererMongoClient, gathererMongoCollections, filterActiveCreators
 * Platform Compatibility: Node.js 18+
 *
 * Why this file exists
 * --------------------
 * The gatherer expresses "this creator left the network" by *omitting* them from the
 * active output set (see processing/filterActiveCreators.ts). The Google Sheet publish
 * honours that by deleting their row, but the MongoDB publish is upsert-only, so a
 * departed creator's document used to survive forever frozen at its last active state —
 * including `relationship_status: "Effective"` and their final performance metrics.
 *
 * Because the unified app reads MongoDB first and MongoDB takes precedence over the
 * sheet, every downstream departure guard was reading that frozen `Effective` value and
 * letting quit/removed creators keep appearing in rankings, spotlights, and the creator
 * directory.
 *
 * This module closes that gap by writing an explicit membership marker on every run:
 * creators present in the active output are stamped active with the current run id, and
 * creators that the run did not stamp are tombstoned as departed. Nothing is deleted, so
 * all historical creator data and performance snapshots are preserved for reporting.
 *
 * How it is used
 * --------------
 * mongo/publishCreatorsToMongo.ts merges the active `$set` fragment into its creator
 * upsert, then calls the sweep once the upsert has fully succeeded. The unified backend
 * reads these fields via services/infiniviewCreatorRosterMembershipService.ts.
 */

import { Filter } from "mongodb";
import { GathererConfig } from "../config";
import { FilterActiveCreatorsExcludedEntry } from "../processing/filterActiveCreators";
import { logDebug, logError, logInfo } from "../logging/logger";
import { gathererGetMongoDb } from "./gathererMongoClient";
import { GATHERER_MONGO_COLLECTION_CREATORS } from "./gathererMongoCollections";

const GATHERER_ROSTER_MEMBERSHIP_SOURCE = "gathererMongoRosterMembership";

// MARK: - Field And Value Constants

/** Creator document field holding the network membership marker. */
export const GATHERER_ROSTER_MEMBERSHIP_FIELD_STATUS = "roster_membership_status";

/** ISO timestamp of the last run that saw this creator in the active output. */
export const GATHERER_ROSTER_MEMBERSHIP_FIELD_LAST_ACTIVE_AT =
  "roster_membership_last_active_at";

/** Run id of the last run that saw this creator in the active output. */
export const GATHERER_ROSTER_MEMBERSHIP_FIELD_LAST_ACTIVE_RUN_ID =
  "roster_membership_last_active_run_id";

/** ISO timestamp of the run that first observed this creator as gone. */
export const GATHERER_ROSTER_MEMBERSHIP_FIELD_DEPARTED_DETECTED_AT =
  "roster_membership_departed_detected_at";

/** Why the creator is considered gone (see the departure reason constants below). */
export const GATHERER_ROSTER_MEMBERSHIP_FIELD_DEPARTED_REASON =
  "roster_membership_departed_reason";

/** Run id of the run that tombstoned this creator. */
export const GATHERER_ROSTER_MEMBERSHIP_FIELD_DEPARTED_RUN_ID =
  "roster_membership_departed_run_id";

/** Creator is on the active management roster as of the last successful run. */
export const GATHERER_ROSTER_MEMBERSHIP_STATUS_ACTIVE = "active";

/** Creator quit, was removed, or otherwise dropped out of the active roster. */
export const GATHERER_ROSTER_MEMBERSHIP_STATUS_DEPARTED = "departed";

/**
 * Departure reasons. The first three mirror `filterActiveCreatorsForOutput` exclusion
 * reasons, so a tombstone records *why* the creator dropped out when the run still saw
 * them in the Backstage export. The fallback covers creators that vanished from the
 * Backstage reports entirely (the usual outcome once an account is fully off-boarded).
 */
export const GATHERER_ROSTER_MEMBERSHIP_REASON_NOT_IN_MANAGEMENT_ROSTER =
  "not_in_management_roster";
export const GATHERER_ROSTER_MEMBERSHIP_REASON_INACTIVE_RELATIONSHIP_STATUS =
  "inactive_relationship_status";
export const GATHERER_ROSTER_MEMBERSHIP_REASON_EXCLUDED_GRADUATION_STATUS =
  "excluded_graduation_status";
export const GATHERER_ROSTER_MEMBERSHIP_REASON_ABSENT_FROM_OUTPUT =
  "absent_from_active_gatherer_output";

// MARK: - Result Types

export interface GathererRosterMembershipDeparture {
  backstageCreatorId: string;
  reason: string;
}

export interface GathererRosterMembershipSweepResult {
  /** True when the sweep ran to completion (even if it marked nobody). */
  swept: boolean;
  /** Populated only when the sweep deliberately declined to run. */
  skippedReason: string | null;
  /** Documents that this run would tombstone. */
  candidateCount: number;
  /** Non-departed documents before the sweep, used for the safety ratio. */
  activeBeforeSweepCount: number;
  /** Documents actually transitioned to departed by this run. */
  markedDepartedCount: number;
  /** Documents already tombstoned by an earlier run (left untouched). */
  alreadyDepartedCount: number;
}

// MARK: - Active Stamp

/**
 * `$set` fragment merged into the creator upsert for every creator in the active output.
 *
 * Writing the run id here is what makes the sweep cheap and exact: after the upsert, any
 * creator document whose stamp is not this run's id was not in the active output, so it
 * can be tombstoned without shipping a multi-thousand-element `$nin` array to MongoDB.
 *
 * Clearing the departure fields is what lets a returning creator heal automatically — a
 * re-signed creator flips straight back to active on the next run with no manual work.
 */
export function gathererRosterMembershipBuildActiveStampFields(
  runId: string,
  seenAt: string
): Record<string, string | null> {
  return {
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_STATUS]: GATHERER_ROSTER_MEMBERSHIP_STATUS_ACTIVE,
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_LAST_ACTIVE_AT]: seenAt,
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_LAST_ACTIVE_RUN_ID]: runId,
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_DEPARTED_DETECTED_AT]: null,
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_DEPARTED_REASON]: null,
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_DEPARTED_RUN_ID]: null,
  };
}

// MARK: - Departure Reason Mapping

/**
 * Converts filter exclusions into per-creator departure reasons.
 *
 * Only creators the run actually saw can carry a specific reason; everyone else falls
 * through to `absent_from_active_gatherer_output` in the sweep.
 */
export function gathererRosterMembershipBuildDeparturesFromExclusions(
  excludedCreators: readonly FilterActiveCreatorsExcludedEntry[]
): GathererRosterMembershipDeparture[] {
  const departures: GathererRosterMembershipDeparture[] = [];

  for (const entry of excludedCreators) {
    const backstageCreatorId = String(entry.creator.backstage_creator_id ?? "").trim();
    if (!backstageCreatorId) {
      continue;
    }
    departures.push({ backstageCreatorId, reason: entry.reason });
  }

  return departures;
}

// MARK: - Sweep Helpers

function gathererRosterMembershipBuildCandidateFilter(runId: string): Filter<Record<string, unknown>> {
  return {
    backstage_creator_id: { $exists: true, $ne: "" },
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_STATUS]: {
      $ne: GATHERER_ROSTER_MEMBERSHIP_STATUS_DEPARTED,
    },
    // Missing field also matches `$ne`, which is exactly what we want for documents
    // written before membership stamping existed.
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_LAST_ACTIVE_RUN_ID]: { $ne: runId },
  };
}

function gathererRosterMembershipBuildDepartedSetFields(
  runId: string,
  detectedAt: string,
  reason: string
): Record<string, string> {
  return {
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_STATUS]: GATHERER_ROSTER_MEMBERSHIP_STATUS_DEPARTED,
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_DEPARTED_DETECTED_AT]: detectedAt,
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_DEPARTED_REASON]: reason,
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_DEPARTED_RUN_ID]: runId,
  };
}

function gathererRosterMembershipGroupDeparturesByReason(
  departures: readonly GathererRosterMembershipDeparture[]
): Map<string, string[]> {
  const idsByReason = new Map<string, string[]>();

  for (const departure of departures) {
    const existing = idsByReason.get(departure.reason);
    if (existing) {
      existing.push(departure.backstageCreatorId);
    } else {
      idsByReason.set(departure.reason, [departure.backstageCreatorId]);
    }
  }

  return idsByReason;
}

function gathererRosterMembershipResolveMaxSweepRatio(config: GathererConfig): number {
  const configured = config.gathererMongoDepartedTombstoneMaxRatio;
  if (!Number.isFinite(configured)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0.01, configured));
}

// MARK: - Public Sweep API

/**
 * Tombstones every creator document the current run did not stamp as active.
 *
 * Must be called only after the active creator upsert has fully succeeded, otherwise a
 * partially written batch would leave genuinely active creators unstamped and get them
 * marked departed. `publishCreatorsToMongo` guarantees this ordering: its bulk write
 * throws on any failed operation, which skips the sweep entirely.
 *
 * Tombstones are non-destructive and self-healing — no document or snapshot is deleted,
 * and any creator that reappears in a later run is stamped active again — so the safety
 * ratio below exists only to stop a badly truncated Backstage export from flipping the
 * whole roster at once.
 */
export async function gathererRosterMembershipMarkDepartedCreators(
  config: GathererConfig,
  runId: string,
  detectedAt: string,
  knownDepartures: readonly GathererRosterMembershipDeparture[]
): Promise<GathererRosterMembershipSweepResult> {
  const emptyResult: GathererRosterMembershipSweepResult = {
    swept: false,
    skippedReason: null,
    candidateCount: 0,
    activeBeforeSweepCount: 0,
    markedDepartedCount: 0,
    alreadyDepartedCount: 0,
  };

  if (config.gathererMongoDepartedTombstoneEnabled === false) {
    logInfo(
      "Departed creator tombstone sweep disabled (GATHERER_MONGO_DEPARTED_TOMBSTONE_ENABLED=false)",
      GATHERER_ROSTER_MEMBERSHIP_SOURCE
    );
    return { ...emptyResult, skippedReason: "disabled" };
  }

  const normalizedRunId = String(runId ?? "").trim();
  if (!normalizedRunId) {
    logError(
      "Departed creator tombstone sweep skipped — run id is empty",
      GATHERER_ROSTER_MEMBERSHIP_SOURCE
    );
    return { ...emptyResult, skippedReason: "missing_run_id" };
  }

  const db = gathererGetMongoDb();
  const collection = db.collection<Record<string, unknown>>(GATHERER_MONGO_COLLECTION_CREATORS);

  const stampedActiveCount = await collection.countDocuments({
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_LAST_ACTIVE_RUN_ID]: normalizedRunId,
  });

  if (stampedActiveCount === 0) {
    logError(
      "Departed creator tombstone sweep skipped — this run stamped no active creators, so every document would be tombstoned",
      GATHERER_ROSTER_MEMBERSHIP_SOURCE,
      { runId: normalizedRunId }
    );
    return { ...emptyResult, skippedReason: "no_active_creators_stamped" };
  }

  const candidateFilter = gathererRosterMembershipBuildCandidateFilter(normalizedRunId);
  const candidateCount = await collection.countDocuments(candidateFilter);
  const alreadyDepartedCount = await collection.countDocuments({
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_STATUS]: GATHERER_ROSTER_MEMBERSHIP_STATUS_DEPARTED,
  });

  if (candidateCount === 0) {
    logDebug(
      "Departed creator tombstone sweep found nothing to mark — every creator document was seen by this run",
      GATHERER_ROSTER_MEMBERSHIP_SOURCE,
      { runId: normalizedRunId, alreadyDepartedCount }
    );
    return {
      swept: true,
      skippedReason: null,
      candidateCount: 0,
      activeBeforeSweepCount: stampedActiveCount,
      markedDepartedCount: 0,
      alreadyDepartedCount,
    };
  }

  const activeBeforeSweepCount = await collection.countDocuments({
    backstage_creator_id: { $exists: true, $ne: "" },
    [GATHERER_ROSTER_MEMBERSHIP_FIELD_STATUS]: {
      $ne: GATHERER_ROSTER_MEMBERSHIP_STATUS_DEPARTED,
    },
  });

  const maxSweepRatio = gathererRosterMembershipResolveMaxSweepRatio(config);
  const sweepRatio = activeBeforeSweepCount > 0 ? candidateCount / activeBeforeSweepCount : 1;

  if (sweepRatio > maxSweepRatio) {
    logError(
      `Departed creator tombstone sweep skipped — ${candidateCount} of ${activeBeforeSweepCount} non-departed creators (${Math.round(sweepRatio * 100)}%) would be marked departed, above the ${Math.round(maxSweepRatio * 100)}% safety limit. This usually means the Backstage export was incomplete. If the drop is genuine, raise GATHERER_MONGO_DEPARTED_TOMBSTONE_MAX_RATIO and re-run.`,
      GATHERER_ROSTER_MEMBERSHIP_SOURCE,
      { runId: normalizedRunId, candidateCount, activeBeforeSweepCount, maxSweepRatio }
    );
    return {
      ...emptyResult,
      skippedReason: "above_max_sweep_ratio",
      candidateCount,
      activeBeforeSweepCount,
      alreadyDepartedCount,
    };
  }

  let markedDepartedCount = 0;

  // Creators the run still saw in the Backstage export get their specific exclusion
  // reason. These run first so the catch-all below cannot overwrite the precise reason.
  const idsByReason = gathererRosterMembershipGroupDeparturesByReason(knownDepartures);
  for (const [reason, backstageCreatorIds] of idsByReason) {
    if (backstageCreatorIds.length === 0) {
      continue;
    }

    const reasonResult = await collection.updateMany(
      { ...candidateFilter, backstage_creator_id: { $in: backstageCreatorIds } },
      { $set: gathererRosterMembershipBuildDepartedSetFields(normalizedRunId, detectedAt, reason) }
    );
    markedDepartedCount += reasonResult.modifiedCount;
  }

  // Everyone still unstamped vanished from the Backstage reports altogether.
  const absentResult = await collection.updateMany(candidateFilter, {
    $set: gathererRosterMembershipBuildDepartedSetFields(
      normalizedRunId,
      detectedAt,
      GATHERER_ROSTER_MEMBERSHIP_REASON_ABSENT_FROM_OUTPUT
    ),
  });
  markedDepartedCount += absentResult.modifiedCount;

  logInfo(
    `Marked ${markedDepartedCount} creators departed — they are no longer on the active roster and will be hidden from rankings, spotlights, and the creator directory (data retained)`,
    GATHERER_ROSTER_MEMBERSHIP_SOURCE,
    {
      runId: normalizedRunId,
      candidateCount,
      activeBeforeSweepCount,
      alreadyDepartedCount,
      database: config.mongodbDbName,
    }
  );

  return {
    swept: true,
    skippedReason: null,
    candidateCount,
    activeBeforeSweepCount,
    markedDepartedCount,
    alreadyDepartedCount,
  };
}

// Suggestions For Features and Additions Later:
// - Publish a departed_creators audit tab so off-boarding is reviewable in the sheet
// - Optional grace period (tombstone only after N consecutive runs without the creator)
// - Emit an ops notification when a single run tombstones more than a handful of creators
