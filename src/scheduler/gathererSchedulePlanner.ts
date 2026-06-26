/**
 * Filename: gathererSchedulePlanner.ts
 * Purpose: Build fixed or randomized daily gatherer run times with daily-archive slot.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-25
 * Dependencies: GathererConfig
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";

// MARK: - Types

export type GathererScheduleMode = "fixed" | "random";

export interface GathererPlannedRun {
  timeLabel: string;
  slotIndex: number;
  slotTotal: number;
  isDailyFinalRun: boolean;
}

// MARK: - Time Helpers

function gathererScheduleParseTimeToMinutes(timeLabel: string): number {
  const [hourText, minuteText] = timeLabel.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`Invalid schedule time: ${timeLabel}`);
  }
  return hour * 60 + minute;
}

function gathererScheduleFormatMinutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function gathererScheduleMinutesDistance(a: number, b: number): number {
  return Math.abs(a - b);
}

// MARK: - Fixed Schedules

export function gathererLoadFixedRunScheduleLabels(): string[] {
  const commaList = process.env.RUN_SCHEDULES?.trim();
  if (commaList) {
    return commaList.split(",").map((value) => value.trim()).filter(Boolean);
  }

  const fromNumberedEnv: string[] = [];
  for (let index = 1; index <= 24; index += 1) {
    const value = process.env[`RUN_SCHEDULE_${index}`]?.trim();
    if (value) {
      fromNumberedEnv.push(value);
    }
  }

  if (fromNumberedEnv.length > 0) {
    return fromNumberedEnv;
  }

  return ["08:00", "12:00", "16:00", "20:00"];
}

function gathererPlanFixedDailyRuns(config: GathererConfig): GathererPlannedRun[] {
  const labels = [...config.runSchedules].sort(
    (left, right) =>
      gathererScheduleParseTimeToMinutes(left) - gathererScheduleParseTimeToMinutes(right)
  );
  const archiveMinutes = gathererScheduleParseTimeToMinutes(config.gathererDailyArchiveTime);
  let dailyFinalIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  labels.forEach((label, index) => {
    const distance = gathererScheduleMinutesDistance(
      gathererScheduleParseTimeToMinutes(label),
      archiveMinutes
    );
    if (distance < closestDistance) {
      closestDistance = distance;
      dailyFinalIndex = index;
    }
  });

  return labels.map((timeLabel, index) => ({
    timeLabel,
    slotIndex: index + 1,
    slotTotal: labels.length,
    isDailyFinalRun: index === dailyFinalIndex,
  }));
}

// MARK: - Random Schedules

function gathererRandomInt(minInclusive: number, maxInclusive: number): number {
  return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

function gathererPlanRandomDailyRuns(config: GathererConfig): GathererPlannedRun[] {
  const startMinutes = gathererScheduleParseTimeToMinutes(config.gathererActiveHoursStart);
  const endMinutes = gathererScheduleParseTimeToMinutes(config.gathererActiveHoursEnd);
  const windowMinutes = endMinutes - startMinutes;
  const minGap = config.gathererMinMinutesBetweenRuns;
  let runsPerDay = config.gathererRunsPerDay;

  if (windowMinutes <= 0) {
    throw new Error("GATHERER_ACTIVE_HOURS_END must be after GATHERER_ACTIVE_HOURS_START");
  }

  while (runsPerDay > 1 && windowMinutes < (runsPerDay - 1) * minGap) {
    runsPerDay -= 1;
  }

  if (runsPerDay < 1) {
    runsPerDay = 1;
  }

  const segmentSize = Math.floor(windowMinutes / runsPerDay);
  const minuteMarks: number[] = [];

  for (let index = 0; index < runsPerDay; index += 1) {
    const segmentStart = startMinutes + index * segmentSize;
    const segmentEnd =
      index === runsPerDay - 1 ? endMinutes : segmentStart + segmentSize - 1;
    const jitter = gathererRandomInt(
      -config.gathererRunJitterMinutes,
      config.gathererRunJitterMinutes
    );
    let candidate = segmentStart + gathererRandomInt(0, Math.max(0, segmentEnd - segmentStart)) + jitter;
    candidate = Math.max(startMinutes, Math.min(endMinutes, candidate));
    minuteMarks.push(candidate);
  }

  minuteMarks.sort((left, right) => left - right);

  for (let index = 1; index < minuteMarks.length; index += 1) {
    if (minuteMarks[index] - minuteMarks[index - 1] < minGap) {
      minuteMarks[index] = Math.min(endMinutes, minuteMarks[index - 1] + minGap);
    }
  }

  const labels = minuteMarks.map((minutes) => gathererScheduleFormatMinutesToTime(minutes));
  const archiveMinutes = gathererScheduleParseTimeToMinutes(config.gathererDailyArchiveTime);
  let dailyFinalIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  labels.forEach((label, index) => {
    const distance = gathererScheduleMinutesDistance(
      gathererScheduleParseTimeToMinutes(label),
      archiveMinutes
    );
    if (distance < closestDistance) {
      closestDistance = distance;
      dailyFinalIndex = index;
    }
  });

  return labels.map((timeLabel, index) => ({
    timeLabel,
    slotIndex: index + 1,
    slotTotal: labels.length,
    isDailyFinalRun: index === dailyFinalIndex,
  }));
}

// MARK: - Public Planner

export function planGathererDailyRuns(config: GathererConfig): GathererPlannedRun[] {
  if (config.gathererScheduleMode === "random") {
    return gathererPlanRandomDailyRuns(config);
  }
  return gathererPlanFixedDailyRuns(config);
}

export function gathererFilterFuturePlannedRuns(
  plannedRuns: GathererPlannedRun[],
  timezone: string,
  now: Date = new Date()
): GathererPlannedRun[] {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);
  const nowMinutes = hour * 60 + minute;

  return plannedRuns.filter((run) => {
    const runMinutes = gathererScheduleParseTimeToMinutes(run.timeLabel);
    return runMinutes > nowMinutes;
  });
}

// Suggestions For Features and Additions Later:
// - Persist today's planned times to data/logs/daily-schedule.json for debugging
// - Weight random runs toward business hours peaks
