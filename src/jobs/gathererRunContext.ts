/**
 * Filename: gathererRunContext.ts
 * Purpose: Resolve scheduled vs manual run behavior — daily sheet updates and final archive slot.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-25
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import {
  gathererFormatBusinessDateKey,
  gathererFormatClosingBusinessDateKey,
} from "../utils/dates";

// MARK: - Types

export type GathererRunTrigger = "scheduled" | "manual";

export interface GathererJobOptions {
  trigger?: GathererRunTrigger;
  scheduledTime?: string;
  scheduledSlotIndex?: number;
  scheduledSlotTotal?: number;
  isDailyFinalRun?: boolean;
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
  let scheduledSlotTotal =
    options.scheduledSlotTotal ?? config.runSchedules.length;

  let scheduledTime: string | null = null;
  let scheduledSlotIndex: number | null = null;

  if (runTrigger === "scheduled" && options.scheduledTime) {
    scheduledTime = options.scheduledTime;
    if (options.scheduledSlotIndex !== undefined && options.scheduledSlotTotal !== undefined) {
      scheduledSlotIndex = options.scheduledSlotIndex;
      scheduledSlotTotal = options.scheduledSlotTotal;
    } else {
      const scheduleIndex = config.runSchedules.indexOf(options.scheduledTime);
      scheduledSlotIndex = scheduleIndex >= 0 ? scheduleIndex + 1 : scheduledSlotTotal;
    }
  }

  const isDailyFinalRun =
    options.isDailyFinalRun !== undefined
      ? options.isDailyFinalRun
      : runTrigger === "scheduled" &&
        scheduledSlotIndex !== null &&
        scheduledSlotIndex === scheduledSlotTotal;

  const dailyDateKey = isDailyFinalRun
    ? gathererFormatClosingBusinessDateKey(
        config.timezone,
        config.gathererDailyArchiveTime,
        now
      )
    : gathererFormatBusinessDateKey(config.timezone, config.gathererDailyArchiveTime, now);

  const dailySheetPrefix = process.env.GATHERER_DAILY_SHEET_TAB_PREFIX ?? "Daily";
  const dailySheetTabName = `${dailySheetPrefix}_${dailyDateKey}`;
  const dailyOutputBaseName = `combined-creators-${dailyDateKey}`;

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
