/**
 * Filename: gathererSnapshotDeltaEngine.ts
 * Purpose: Derive daily contribution metrics from cumulative MTD sheet values vs prior day.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: gathererCreatorDailySnapshot types
 * Platform Compatibility: Node.js 18+
 */

import {
  GathererCreatorDailySnapshotDataStatus,
  GathererSnapshotCumulativeMetrics,
} from "../types/gathererCreatorDailySnapshot";

// MARK: Constants

/** Minimum LIVE hours for a valid LIVE day (61 minutes). */
export const GATHERER_SNAPSHOT_VALID_LIVE_DAY_MIN_HOURS = 61 / 60;

const GATHERER_SNAPSHOT_DELTA_ENGINE_SOURCE = "gathererSnapshotDeltaEngine";

/** Stored on snapshots when the first in-month cumulative appears after missing archive days. */
export const GATHERER_SNAPSHOT_DELTA_NOTE_MTD_THROUGH_DATE = "MTD_THROUGH_DATE_NOT_SINGLE_DAY";

/** Float tolerance when comparing summed daily totals to cumulative MTD. */
export const GATHERER_SNAPSHOT_VERIFICATION_TOLERANCE = 1.5;

// MARK: Derived Daily Metrics

export interface GathererSnapshotDerivedDailyMetrics {
  diamonds: number | null;
  liveHours: number | null;
  validLiveDay: boolean;
  liveDays: number;
  dataStatus: GathererCreatorDailySnapshotDataStatus;
  dataStatusNote: string | null;
}

// MARK: Date Helpers

export function gathererSnapshotDeltaEngineSnapshotMonth(snapshotDate: string): string {
  return snapshotDate.slice(0, 7);
}

export function gathererSnapshotDeltaEnginePriorDateKey(snapshotDate: string): string {
  const [yearText, monthText, dayText] = snapshotDate.split("-");
  const date = new Date(
    Date.UTC(Number.parseInt(yearText, 10), Number.parseInt(monthText, 10) - 1, Number.parseInt(dayText, 10))
  );
  date.setUTCDate(date.getUTCDate() - 1);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function gathererSnapshotDeltaEngineIsSameMonth(dateA: string, dateB: string): boolean {
  return dateA.slice(0, 7) === dateB.slice(0, 7);
}

function gathererSnapshotDeltaEngineIsFirstDayOfMonth(snapshotDate: string): boolean {
  return snapshotDate.endsWith("-01");
}

function gathererSnapshotDeltaEngineLooksLikeMonthReset(
  current: GathererSnapshotCumulativeMetrics,
  prior: GathererSnapshotCumulativeMetrics
): boolean {
  if (current.diamonds === null || prior.diamonds === null) {
    return false;
  }
  return current.diamonds < prior.diamonds;
}

function gathererSnapshotDeltaEngineSubtractNullable(
  current: number | null,
  prior: number | null
): number | null {
  if (current === null || prior === null) {
    return null;
  }
  return Math.max(0, current - prior);
}

function gathererSnapshotDeltaEngineResolveValidLiveDay(
  dailyLiveHours: number | null,
  cumulativeValidDays: number | null,
  priorCumulativeValidDays: number | null
): boolean {
  if (
    cumulativeValidDays !== null &&
    priorCumulativeValidDays !== null &&
    cumulativeValidDays > priorCumulativeValidDays
  ) {
    return true;
  }
  if (dailyLiveHours !== null && dailyLiveHours >= GATHERER_SNAPSHOT_VALID_LIVE_DAY_MIN_HOURS) {
    return true;
  }
  return false;
}

// MARK: Delta Derivation

export function gathererSnapshotDeltaEngineDeriveDailyMetrics(input: {
  snapshotDate: string;
  current: GathererSnapshotCumulativeMetrics;
  prior: GathererSnapshotCumulativeMetrics | null;
  /** Calendar date of the prior snapshot row used for delta math (if any). */
  priorSnapshotDate?: string | null;
}): GathererSnapshotDerivedDailyMetrics {
  const { snapshotDate, current, prior, priorSnapshotDate } = input;

  const hasAnyCurrent =
    current.diamonds !== null || current.liveHours !== null || current.validDays !== null;

  if (!hasAnyCurrent) {
    return {
      diamonds: null,
      liveHours: null,
      validLiveDay: false,
      liveDays: 0,
      dataStatus: "missing_data",
      dataStatusNote: "No cumulative metrics in source row",
    };
  }

  const priorHasUsableMetrics =
    prior !== null &&
    (prior.diamonds !== null || prior.liveHours !== null || prior.validDays !== null);

  const effectivePrior = priorHasUsableMetrics ? prior : null;

  const isTrueMonthStart =
    gathererSnapshotDeltaEngineIsFirstDayOfMonth(snapshotDate) ||
    (effectivePrior !== null &&
      gathererSnapshotDeltaEngineLooksLikeMonthReset(current, effectivePrior)) ||
    (effectivePrior !== null &&
      priorSnapshotDate !== null &&
      priorSnapshotDate !== undefined &&
      !gathererSnapshotDeltaEngineIsSameMonth(snapshotDate, priorSnapshotDate));

  if (effectivePrior === null) {
    const dailyLiveHours = current.liveHours;
    const validLiveDay = gathererSnapshotDeltaEngineResolveValidLiveDay(
      dailyLiveHours,
      current.validDays,
      null
    );
    const validDaysCount =
      current.validDays !== null ? Math.max(0, Math.round(current.validDays)) : validLiveDay ? 1 : 0;

    if (gathererSnapshotDeltaEngineIsFirstDayOfMonth(snapshotDate)) {
      return {
        diamonds: current.diamonds,
        liveHours: dailyLiveHours,
        validLiveDay: validLiveDay || validDaysCount > 0,
        liveDays: validLiveDay || validDaysCount > 0 ? 1 : 0,
        dataStatus: current.diamonds === null && current.liveHours === null ? "partial" : "complete",
        dataStatusNote: "Month start — daily equals MTD cumulative",
      };
    }

    return {
      diamonds: current.diamonds,
      liveHours: dailyLiveHours,
      validLiveDay: validLiveDay || validDaysCount > 0,
      liveDays: validLiveDay || validDaysCount > 0 ? 1 : 0,
      dataStatus: "partial",
      dataStatusNote: GATHERER_SNAPSHOT_DELTA_NOTE_MTD_THROUGH_DATE,
    };
  }

  if (isTrueMonthStart) {
    const dailyLiveHours = current.liveHours;
    const validLiveDay = gathererSnapshotDeltaEngineResolveValidLiveDay(
      dailyLiveHours,
      current.validDays,
      null
    );
    const validDaysCount =
      current.validDays !== null ? Math.max(0, Math.round(current.validDays)) : validLiveDay ? 1 : 0;

    return {
      diamonds: current.diamonds,
      liveHours: dailyLiveHours,
      validLiveDay: validLiveDay || validDaysCount > 0,
      liveDays: validLiveDay || validDaysCount > 0 ? 1 : 0,
      dataStatus: current.diamonds === null && current.liveHours === null ? "partial" : "complete",
      dataStatusNote: "Month start — daily equals MTD cumulative",
    };
  }

  const dailyDiamonds = gathererSnapshotDeltaEngineSubtractNullable(
    current.diamonds,
    effectivePrior.diamonds
  );
  const dailyLiveHours = gathererSnapshotDeltaEngineSubtractNullable(
    current.liveHours,
    effectivePrior.liveHours
  );
  const validLiveDay = gathererSnapshotDeltaEngineResolveValidLiveDay(
    dailyLiveHours,
    current.validDays,
    effectivePrior.validDays
  );

  let dataStatus: GathererCreatorDailySnapshotDataStatus = "complete";
  let dataStatusNote: string | null = null;

  if (dailyDiamonds === null || dailyLiveHours === null) {
    dataStatus = "partial";
    dataStatusNote = "Missing prior-day cumulative — delta incomplete";
  }

  return {
    diamonds: dailyDiamonds,
    liveHours: dailyLiveHours,
    validLiveDay,
    liveDays: validLiveDay ? 1 : 0,
    dataStatus,
    dataStatusNote,
  };
}

export function gathererSnapshotDeltaEngineNumbersMatch(
  sumValue: number,
  cumulativeValue: number | null,
  tolerance: number = GATHERER_SNAPSHOT_VERIFICATION_TOLERANCE
): boolean {
  if (cumulativeValue === null) {
    return false;
  }
  return Math.abs(sumValue - cumulativeValue) <= tolerance;
}

export function gathererSnapshotDeltaEngineSourceLabel(): string {
  return GATHERER_SNAPSHOT_DELTA_ENGINE_SOURCE;
}

// Suggestions For Features and Additions Later:
// - Use performance_data_period column to detect month boundaries explicitly
// - Session-level valid day inference when live_streams delta is available
