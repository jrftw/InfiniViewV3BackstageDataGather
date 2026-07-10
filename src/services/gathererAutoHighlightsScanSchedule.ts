/**
 * Filename: gathererAutoHighlightsScanSchedule.ts
 * Purpose: Active-hours guard and cron planning for community highlight scans (Priority 9).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-10
 * Dependencies: GathererConfig
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";

// MARK: Active Window

/** Returns local hour (0–23) in the gatherer timezone for [now]. */
export function gathererAutoHighlightsScanScheduleResolveLocalHour(
  timezone: string,
  now: Date = new Date()
): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);

  return Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
}

/** True when highlight scans are allowed (default 8:00 AM–8:00 PM America/New_York). */
export function gathererAutoHighlightsScanScheduleIsWithinActiveWindow(
  config: Pick<
    GathererConfig,
    "timezone" | "gathererAutoHighlightsScanActiveHourStart" | "gathererAutoHighlightsScanActiveHourEnd"
  >,
  now: Date = new Date()
): boolean {
  const hour = gathererAutoHighlightsScanScheduleResolveLocalHour(config.timezone, now);
  return (
    hour >= config.gathererAutoHighlightsScanActiveHourStart &&
    hour <= config.gathererAutoHighlightsScanActiveHourEnd
  );
}

/** Cron expression: top of each hour during the configured active window. */
export function gathererAutoHighlightsScanScheduleBuildHourlyCronExpression(
  config: Pick<
    GathererConfig,
    "gathererAutoHighlightsScanActiveHourStart" | "gathererAutoHighlightsScanActiveHourEnd"
  >
): string {
  const startHour = Math.max(0, Math.min(23, config.gathererAutoHighlightsScanActiveHourStart));
  const endHour = Math.max(startHour, Math.min(23, config.gathererAutoHighlightsScanActiveHourEnd));
  return `0 ${startHour}-${endHour} * * *`;
}

// Suggestions For Features and Additions Later:
// - Skip US federal holidays via configurable calendar
