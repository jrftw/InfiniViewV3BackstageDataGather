/**
 * Filename: scheduler.ts
 * Purpose: Schedule gatherer runs — fixed times or randomized daily plan with jitter.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-30
 * Dependencies: node-cron, gathererSchedulePlanner
 * Platform Compatibility: Node.js 18+
 */

import path from "path";
import cron, { ScheduledTask } from "node-cron";
import { GathererConfig } from "./config";
import { runGathererJob } from "./jobs/runGathererJob";
import { getGathererMinutesSinceLastRunStarted } from "./jobs/runState";
import { ImportSummaryData } from "./logging/importSummary";
import { logInfo, logError } from "./logging/logger";
import {
  GathererPlannedRun,
  gathererFilterFuturePlannedRuns,
  planGathererDailyRuns,
} from "./scheduler/gathererSchedulePlanner";
import { gathererFormatBusinessDateKey } from "./utils/dates";
import { gathererReadJsonFile } from "./utils/files";
import { runSnapshotHistoryImportJob } from "./jobs/runSnapshotHistoryImportJob";
import { gathererInfiniviewCommunityHighlightScanClientRun } from "./services/gathererInfiniviewCommunityHighlightScanClient";
import { gathererAutoHighlightsScanScheduleBuildHourlyCronExpression } from "./services/gathererAutoHighlightsScanSchedule";

const GATHERER_STARTUP_CATCHUP_DELAY_MS = 3 * 60 * 1000;
const GATHERER_LAST_SUMMARY_RELATIVE_PATH = "data/logs/last-run-summary.json";

// MARK: - Cron Helpers

function gathererTimeToCron(timeLabel: string): string {
  const [hour, minute] = timeLabel.split(":").map((value) => parseInt(value, 10));
  return `${minute} ${hour} * * *`;
}

function gathererMsUntilNextMidnight(timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);
  const second = Number.parseInt(parts.find((part) => part.type === "second")?.value ?? "0", 10);
  const elapsedMs = ((hour * 60 + minute) * 60 + second) * 1000;
  return Math.max(60_000, 24 * 60 * 60 * 1000 - elapsedMs + 5_000);
}

// MARK: - Scheduler State

const gathererScheduledCronTasks: ScheduledTask[] = [];
let gathererMidnightRescheduleTimer: NodeJS.Timeout | null = null;

function gathererStopScheduledCronTasks(): void {
  for (const task of gathererScheduledCronTasks) {
    task.stop();
  }
  gathererScheduledCronTasks.length = 0;
}

function gathererLogPlannedRuns(config: GathererConfig, plannedRuns: GathererPlannedRun[]): void {
  const modeLabel = config.gathererScheduleMode === "random" ? "randomized" : "fixed";
  const summary = plannedRuns
    .map((run) => `${run.timeLabel}${run.isDailyFinalRun ? "*" : ""}`)
    .join(", ");
  logInfo(`Today's ${modeLabel} gatherer plan (${plannedRuns.length} runs): ${summary}`, "scheduler");
  logInfo("Runs marked * upload the daily Drive archive", "scheduler");
}

async function gathererTriggerPlannedRun(
  config: GathererConfig,
  plannedRun: GathererPlannedRun
): Promise<void> {
  const minutesSinceLastRun = getGathererMinutesSinceLastRunStarted();
  if (
    minutesSinceLastRun !== null &&
    minutesSinceLastRun < config.gathererMinMinutesBetweenRuns
  ) {
    logInfo(
      `Skipping ${plannedRun.timeLabel} run — last run was ${minutesSinceLastRun} min ago (min ${config.gathererMinMinutesBetweenRuns})`,
      "scheduler"
    );
    return;
  }

  logInfo(`Scheduled run triggered (${plannedRun.timeLabel})`, "scheduler");
  const result = await runGathererJob({
    trigger: "scheduled",
    scheduledTime: plannedRun.timeLabel,
    scheduledSlotIndex: plannedRun.slotIndex,
    scheduledSlotTotal: plannedRun.slotTotal,
    isDailyFinalRun: plannedRun.isDailyFinalRun,
  });

  if (!result.success) {
    logError("Scheduled run failed", "scheduler", { errors: result.errors });
  }
}

function gathererRegisterPlannedRun(config: GathererConfig, plannedRun: GathererPlannedRun): void {
  const cronExpr = gathererTimeToCron(plannedRun.timeLabel);
  const task = cron.schedule(
    cronExpr,
    () => {
      void gathererTriggerPlannedRun(config, plannedRun);
    },
    { timezone: config.timezone }
  );
  gathererScheduledCronTasks.push(task);
  logInfo(
    `Scheduled gatherer at ${plannedRun.timeLabel} (${config.timezone})${plannedRun.isDailyFinalRun ? " [daily archive]" : ""}`,
    "scheduler"
  );
}

function gathererScheduleRunsForToday(config: GathererConfig): void {
  gathererStopScheduledCronTasks();

  const allPlannedRuns = planGathererDailyRuns(config);
  const futureRuns = gathererFilterFuturePlannedRuns(allPlannedRuns, config.timezone);

  gathererLogPlannedRuns(config, allPlannedRuns);

  if (futureRuns.length === 0) {
    logInfo("No remaining gatherer runs today — new plan at midnight", "scheduler");
    return;
  }

  for (const plannedRun of futureRuns) {
    gathererRegisterPlannedRun(config, plannedRun);
  }
}

function gathererScheduleMidnightReschedule(config: GathererConfig): void {
  if (gathererMidnightRescheduleTimer) {
    clearTimeout(gathererMidnightRescheduleTimer);
  }

  const delayMs = gathererMsUntilNextMidnight(config.timezone);
  gathererMidnightRescheduleTimer = setTimeout(() => {
    logInfo("Midnight reached — generating a new daily gatherer schedule", "scheduler");
    gathererScheduleRunsForToday(config);
    gathererScheduleSnapshotHistoryImport(config);
    gathererScheduleMidnightReschedule(config);
  }, delayMs);
}

// MARK: - Snapshot History Import (12:30 AM ET default)

async function gathererTriggerSnapshotHistoryImport(config: GathererConfig): Promise<void> {
  if (!config.gathererSnapshotHistoryImportEnabled) {
    logInfo("Snapshot history import disabled (GATHERER_SNAPSHOT_HISTORY_IMPORT_ENABLED=false)", "scheduler");
    return;
  }

  logInfo("Scheduled snapshot history import triggered", "scheduler");
  const exitCode = await runSnapshotHistoryImportJob(["--scheduled"]);
  if (exitCode !== 0) {
    logError("Scheduled snapshot history import failed", "scheduler");
  }
}

// MARK: - Auto Highlights Scan (hourly, 8 AM–8 PM ET default)

async function gathererTriggerAutoHighlightsScan(config: GathererConfig): Promise<void> {
  await gathererInfiniviewCommunityHighlightScanClientRun(config, {
    trigger: "scheduled",
  });
}

function gathererScheduleAutoHighlightsScan(config: GathererConfig): void {
  if (!config.gathererAutoHighlightsScanEnabled) {
    logInfo("Auto highlights scan disabled (GATHERER_AUTO_HIGHLIGHTS_SCAN_ENABLED=false)", "scheduler");
    return;
  }

  const cronExpression = gathererAutoHighlightsScanScheduleBuildHourlyCronExpression(config);
  const task = cron.schedule(
    cronExpression,
    () => {
      void gathererTriggerAutoHighlightsScan(config);
    },
    { timezone: config.timezone }
  );

  gathererScheduledCronTasks.push(task);
  logInfo(
    `Scheduled community highlight scan hourly ${String(config.gathererAutoHighlightsScanActiveHourStart).padStart(2, "0")}:00–${String(config.gathererAutoHighlightsScanActiveHourEnd).padStart(2, "0")}:00 (${config.timezone})`,
    "scheduler"
  );
}

function gathererScheduleSnapshotHistoryImport(config: GathererConfig): void {
  if (!config.gathererSnapshotHistoryImportEnabled) {
    return;
  }

  const cronExpression = gathererTimeToCron(config.gathererSnapshotHistoryImportTime);
  const task = cron.schedule(
    cronExpression,
    () => {
      void gathererTriggerSnapshotHistoryImport(config);
    },
    { timezone: config.timezone }
  );

  gathererScheduledCronTasks.push(task);
  logInfo(
    `Scheduled snapshot history import at ${config.gathererSnapshotHistoryImportTime} (${config.timezone})`,
    "scheduler"
  );
}

// MARK: - Startup Catch-Up

function gathererIsStartupCatchUpEnabled(): boolean {
  return process.env.GATHERER_CATCHUP_ON_STARTUP !== "false";
}

function gathererReadLastRunSummary(projectRoot: string): ImportSummaryData | null {
  return gathererReadJsonFile<ImportSummaryData>(
    path.resolve(projectRoot, GATHERER_LAST_SUMMARY_RELATIVE_PATH)
  );
}

function gathererHadSuccessfulRunToday(
  config: GathererConfig,
  summary: ImportSummaryData | null,
  now: Date = new Date()
): boolean {
  if (!summary?.success || !summary.startedAt) {
    return false;
  }

  const lastRunBusinessDay = gathererFormatBusinessDateKey(
    config.timezone,
    config.gathererDailyArchiveTime,
    new Date(summary.startedAt)
  );
  const todayBusinessDay = gathererFormatBusinessDateKey(
    config.timezone,
    config.gathererDailyArchiveTime,
    now
  );

  return lastRunBusinessDay === todayBusinessDay;
}

function gathererHasRemainingRunsToday(config: GathererConfig, now: Date = new Date()): boolean {
  const futureRuns = gathererFilterFuturePlannedRuns(planGathererDailyRuns(config), config.timezone, now);
  return futureRuns.length > 0;
}

async function gathererRunStartupCatchUp(config: GathererConfig): Promise<void> {
  logInfo("Startup catch-up gatherer run triggered", "scheduler");
  const result = await runGathererJob({ trigger: "manual" });
  if (!result.success) {
    logError("Startup catch-up gatherer run failed", "scheduler", { errors: result.errors });
  }
}

export function scheduleGathererStartupCatchUp(config: GathererConfig): void {
  if (!gathererIsStartupCatchUpEnabled()) {
    logInfo("Startup catch-up disabled (GATHERER_CATCHUP_ON_STARTUP=false)", "scheduler");
    return;
  }

  const lastSummary = gathererReadLastRunSummary(config.projectRoot);

  if (gathererHadSuccessfulRunToday(config, lastSummary)) {
    logInfo("Startup catch-up skipped — successful gather already completed today", "scheduler");
    return;
  }

  if (!gathererHasRemainingRunsToday(config)) {
    logInfo("Startup catch-up skipped — no remaining scheduled window today", "scheduler");
    return;
  }

  logInfo(
    `Startup catch-up scheduled in ${GATHERER_STARTUP_CATCHUP_DELAY_MS / 60_000} minutes (missed run recovery)`,
    "scheduler"
  );

  setTimeout(() => {
    void gathererRunStartupCatchUp(config);
  }, GATHERER_STARTUP_CATCHUP_DELAY_MS);
}

// MARK: - Start Scheduler

export function startGathererScheduler(config: GathererConfig): void {
  gathererScheduleRunsForToday(config);
  gathererScheduleSnapshotHistoryImport(config);
  gathererScheduleAutoHighlightsScan(config);
  gathererScheduleMidnightReschedule(config);
  scheduleGathererStartupCatchUp(config);
}

// Suggestions For Features and Additions Later:
// - Skip run if last run was within N minutes (already enforced at trigger time)
// - Expose today's planned schedule on dashboard API
