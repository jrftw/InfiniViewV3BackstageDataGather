/**
 * Filename: gathererRunContext.ts
 * Purpose: Resolve scheduled vs manual run behavior — daily sheet updates and final archive slot.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { gathererFormatDateKeyInTimezone } from "../utils/dates";

// MARK: - Types

export type GathererRunTrigger = "scheduled" | "manual";

export interface GathererJobOptions {
  trigger?: GathererRunTrigger;
  scheduledTime?: string;
}

export interface GathererRunContext {
  runTrigger: GathererRunTrigger;
  scheduledTime: string | null;
  scheduledSlotIndex: number | null;
  scheduledSlotTotal: number;
  isDailyFinalRun: boolean;
  dailyDateKey: string;
  dailySheetTabName: string;
  dailyOutputBaseName: string;
  shouldUploadDailyArchiveToDrive: boolean;
}

// MARK: - Context Builder

export function buildGathererRunContext(
  config: GathererConfig,
  options: GathererJobOptions = {}
): GathererRunContext {
  const runTrigger: GathererRunTrigger = options.trigger ?? "manual";
  const now = new Date();
  const dailyDateKey = gathererFormatDateKeyInTimezone(config.timezone, now);
  const dailySheetPrefix = process.env.GATHERER_DAILY_SHEET_TAB_PREFIX ?? "Daily";
  const dailySheetTabName = `${dailySheetPrefix}_${dailyDateKey}`;
  const dailyOutputBaseName = `combined-creators-${dailyDateKey}`;
  const scheduledSlotTotal = config.runSchedules.length;

  let scheduledTime: string | null = null;
  let scheduledSlotIndex: number | null = null;

  if (runTrigger === "scheduled" && options.scheduledTime) {
    scheduledTime = options.scheduledTime;
    const scheduleIndex = config.runSchedules.indexOf(options.scheduledTime);
    scheduledSlotIndex = scheduleIndex >= 0 ? scheduleIndex + 1 : scheduledSlotTotal;
  }

  const isDailyFinalRun =
    runTrigger === "scheduled" &&
    scheduledSlotIndex !== null &&
    scheduledSlotIndex === scheduledSlotTotal;

  return {
    runTrigger,
    scheduledTime,
    scheduledSlotIndex,
    scheduledSlotTotal,
    isDailyFinalRun,
    dailyDateKey,
    dailySheetTabName,
    dailyOutputBaseName,
    shouldUploadDailyArchiveToDrive: isDailyFinalRun,
  };
}

// Suggestions For Features and Additions Later:
// - Persist daily run counter in data/logs/daily-run-state.json
