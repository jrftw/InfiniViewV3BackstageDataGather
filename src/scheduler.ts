/**
 * Filename: scheduler.ts
 * Purpose: Schedule gatherer runs — fixed times or randomized daily plan with jitter.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-15
 * Dependencies: node-cron, gathererSchedulePlanner, snapshot history import job
 * Platform Compatibility: Node.js 18+
 */

import path from "path";
import cron, { ScheduledTask } from "node-cron";
import { GathererConfig } from "./config";
import { runGathererJob } from "./jobs/runGathererJob";
import { getGathererMinutesSinceLastRunStarted } from "./jobs/runState";
import { runSnapshotHistoryImportJob } from "./jobs/runSnapshotHistoryImportJob";
import { ImportSummaryData } from "./logging/importSummary";
import { logInfo, logError } from "./logging/logger";
import {
  GathererPlannedRun,
  gathererFilterFuturePlannedRuns,
  planGathererDailyRuns,
} from "./scheduler/gathererSchedulePlanner";
import { gathererInfiniviewCommunityHighlightScanClientRun } from "./services/gathererInfiniviewCommunityHighlightScanClient";
import { gathererAutoHighlightsScanScheduleBuildHourlyCronExpression } from "./services/gathererAutoHighlightsScanSchedule";
import { gathererFormatBusinessDateKey } from "./utils/dates";
import { gathererReadJsonFile } from "./utils/files";

const GATHERER_STARTUP_CATCHUP_DELAY_MS = 3 * 60 * 1000;
const GATHERER_SNAPSHOT_HISTORY_STARTUP_CATCHUP_DELAY_MS = 5 * 60 * 1000;
const GATHERER_SNAPSHOT_HISTORY_EMPTY_SCAN_RETRY_DELAY_MS = 5 * 60 * 1000;
const GATHERER_LAST_SUMMARY_RELATIVE_PATH = "data/logs/last-run-summary.json";
const GATHERER_SCHEDULER_SOURCE = "scheduler";

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

function gathererSchedulerDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// MARK: - Scheduler State
// Daily gatherer slots are rebuilt at midnight. Snapshot + highlight crons are persistent
// so midnight rebuilds cannot wipe the 00:30 snapshot import.

const gathererDailyCronTasks: ScheduledTask[] = [];
const gathererPersistentCronTasks: ScheduledTask[] = [];
let gathererMidnightRescheduleTimer: NodeJS.Timeout | null = null;

function gathererStopDailyCronTasks(): void {
  for (const task of gathererDailyCronTasks) {
    task.stop();
  }
  gathererDailyCronTasks.length = 0;
}

function gathererLogPlannedRuns(config: GathererConfig, plannedRuns: GathererPlannedRun[]): void {
  const modeLabel = config.gathererScheduleMode === "random" ? "randomized" : "fixed";
  const summary = plannedRuns
    .map((run) => `${run.timeLabel}${run.isDailyFinalRun ? "*" : ""}`)
    .join(", ");
  logInfo(`Today's ${modeLabel} gatherer plan (${plannedRuns.length} runs): ${summary}`, GATHERER_SCHEDULER_SOURCE);
  logInfo("Runs marked * upload the daily Drive archive", GATHERER_SCHEDULER_SOURCE);
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
      GATHERER_SCHEDULER_SOURCE
    );
    return;
  }

  logInfo(`Scheduled run triggered (${plannedRun.timeLabel})`, GATHERER_SCHEDULER_SOURCE);
  const result = await runGathererJob({
    trigger: "scheduled",
    scheduledTime: plannedRun.timeLabel,
    scheduledSlotIndex: plannedRun.slotIndex,
    scheduledSlotTotal: plannedRun.slotTotal,
    isDailyFinalRun: plannedRun.isDailyFinalRun,
  });

  if (!result.success) {
    logError("Scheduled run failed", GATHERER_SCHEDULER_SOURCE, { errors: result.errors });
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
  gathererDailyCronTasks.push(task);
  logInfo(
    `Scheduled gatherer at ${plannedRun.timeLabel} (${config.timezone})${plannedRun.isDailyFinalRun ? " [daily archive]" : ""}`,
    GATHERER_SCHEDULER_SOURCE
  );
}

function gathererScheduleRunsForToday(config: GathererConfig): void {
  gathererStopDailyCronTasks();

  const allPlannedRuns = planGathererDailyRuns(config);
  const futureRuns = gathererFilterFuturePlannedRuns(allPlannedRuns, config.timezone);

  gathererLogPlannedRuns(config, allPlannedRuns);

  if (futureRuns.length === 0) {
    logInfo("No remaining gatherer runs today — new plan at midnight", GATHERER_SCHEDULER_SOURCE);
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
    logInfo("Midnight reached — generating a new daily gatherer schedule", GATHERER_SCHEDULER_SOURCE);
    gathererScheduleRunsForToday(config);
    gathererScheduleMidnightReschedule(config);
  }, delayMs);
}

// MARK: - Snapshot History Import (12:30 AM ET default)

async function gathererTriggerSnapshotHistoryImport(
  config: GathererConfig,
  context: { reason: "scheduled" | "startup-catchup" | "retry" }
): Promise<boolean> {
  if (!config.gathererSnapshotHistoryImportEnabled) {
    logInfo(
      "Snapshot history import disabled (GATHERER_SNAPSHOT_HISTORY_IMPORT_ENABLED=false)",
      GATHERER_SCHEDULER_SOURCE
    );
    return true;
  }

  logInfo(`Snapshot history import triggered (${context.reason})`, GATHERER_SCHEDULER_SOURCE);
  const exitCode = await runSnapshotHistoryImportJob(["--scheduled"]);
  if (exitCode !== 0) {
    logError(`Snapshot history import failed (${context.reason})`, GATHERER_SCHEDULER_SOURCE);
    return false;
  }

  void gathererInfiniviewCommunityHighlightScanClientRun(config, {
    trigger: "snapshot-import",
  }).catch((error) => {
    logError("Post-snapshot community highlight scan failed", GATHERER_SCHEDULER_SOURCE, {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return true;
}

async function gathererTriggerSnapshotHistoryImportWithRetry(config: GathererConfig): Promise<void> {
  const firstAttemptOk = await gathererTriggerSnapshotHistoryImport(config, { reason: "scheduled" });
  if (firstAttemptOk) {
    return;
  }

  logInfo(
    `Retrying snapshot history import once in ${GATHERER_SNAPSHOT_HISTORY_EMPTY_SCAN_RETRY_DELAY_MS / 60_000} minutes`,
    GATHERER_SCHEDULER_SOURCE
  );
  await gathererSchedulerDelay(GATHERER_SNAPSHOT_HISTORY_EMPTY_SCAN_RETRY_DELAY_MS);
  await gathererTriggerSnapshotHistoryImport(config, { reason: "retry" });
}

function gathererScheduleSnapshotHistoryImport(config: GathererConfig): void {
  if (!config.gathererSnapshotHistoryImportEnabled) {
    return;
  }

  const cronExpression = gathererTimeToCron(config.gathererSnapshotHistoryImportTime);
  const task = cron.schedule(
    cronExpression,
    () => {
      void gathererTriggerSnapshotHistoryImportWithRetry(config);
    },
    { timezone: config.timezone }
  );

  gathererPersistentCronTasks.push(task);
  logInfo(
    `Scheduled snapshot history import at ${config.gathererSnapshotHistoryImportTime} (${config.timezone})`,
    GATHERER_SCHEDULER_SOURCE
  );
}

// MARK: - Auto Highlights Scan (hourly, 8 AM–8 PM ET default)

async function gathererTriggerAutoHighlightsScan(config: GathererConfig): Promise<void> {
  await gathererInfiniviewCommunityHighlightScanClientRun(config, {
    trigger: "scheduled",
  });
}

function gathererScheduleAutoHighlightsScan(config: GathererConfig): void {
  if (!config.gathererAutoHighlightsScanEnabled) {
    logInfo(
      "Auto highlights scan disabled (GATHERER_AUTO_HIGHLIGHTS_SCAN_ENABLED=false)",
      GATHERER_SCHEDULER_SOURCE
    );
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

  gathererPersistentCronTasks.push(task);
  logInfo(
    `Scheduled community highlight scan hourly ${String(config.gathererAutoHighlightsScanActiveHourStart).padStart(2, "0")}:00–${String(config.gathererAutoHighlightsScanActiveHourEnd).padStart(2, "0")}:00 (${config.timezone})`,
    GATHERER_SCHEDULER_SOURCE
  );
}

// MARK: - Startup Catch-Up (gatherer sheet pull)

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
  logInfo("Startup catch-up gatherer run triggered", GATHERER_SCHEDULER_SOURCE);
  const result = await runGathererJob({ trigger: "manual" });
  if (!result.success) {
    logError("Startup catch-up gatherer run failed", GATHERER_SCHEDULER_SOURCE, {
      errors: result.errors,
    });
  }
}

export function scheduleGathererStartupCatchUp(config: GathererConfig): void {
  if (!gathererIsStartupCatchUpEnabled()) {
    logInfo("Startup catch-up disabled (GATHERER_CATCHUP_ON_STARTUP=false)", GATHERER_SCHEDULER_SOURCE);
    return;
  }

  const lastSummary = gathererReadLastRunSummary(config.projectRoot);

  if (gathererHadSuccessfulRunToday(config, lastSummary)) {
    logInfo(
      "Startup catch-up skipped — successful gather already completed today",
      GATHERER_SCHEDULER_SOURCE
    );
    return;
  }

  if (!gathererHasRemainingRunsToday(config)) {
    logInfo(
      "Startup catch-up skipped — no remaining scheduled window today",
      GATHERER_SCHEDULER_SOURCE
    );
    return;
  }

  logInfo(
    `Startup catch-up scheduled in ${GATHERER_STARTUP_CATCHUP_DELAY_MS / 60_000} minutes (missed run recovery)`,
    GATHERER_SCHEDULER_SOURCE
  );

  setTimeout(() => {
    void gathererRunStartupCatchUp(config);
  }, GATHERER_STARTUP_CATCHUP_DELAY_MS);
}

// MARK: - Startup Catch-Up (snapshot history → creator_daily_snapshots)

function gathererIsSnapshotHistoryStartupCatchUpEnabled(): boolean {
  return process.env.GATHERER_SNAPSHOT_HISTORY_CATCHUP_ON_STARTUP !== "false";
}

export function scheduleGathererSnapshotHistoryStartupCatchUp(config: GathererConfig): void {
  if (!config.gathererSnapshotHistoryImportEnabled) {
    return;
  }

  if (!gathererIsSnapshotHistoryStartupCatchUpEnabled()) {
    logInfo(
      "Snapshot history startup catch-up disabled (GATHERER_SNAPSHOT_HISTORY_CATCHUP_ON_STARTUP=false)",
      GATHERER_SCHEDULER_SOURCE
    );
    return;
  }

  logInfo(
    `Snapshot history startup catch-up scheduled in ${GATHERER_SNAPSHOT_HISTORY_STARTUP_CATCHUP_DELAY_MS / 60_000} minutes`,
    GATHERER_SCHEDULER_SOURCE
  );

  setTimeout(() => {
    void gathererTriggerSnapshotHistoryImport(config, { reason: "startup-catchup" });
  }, GATHERER_SNAPSHOT_HISTORY_STARTUP_CATCHUP_DELAY_MS);
}

// MARK: - Start Scheduler

export function startGathererScheduler(config: GathererConfig): void {
  gathererScheduleRunsForToday(config);
  gathererScheduleSnapshotHistoryImport(config);
  gathererScheduleAutoHighlightsScan(config);
  gathererScheduleMidnightReschedule(config);
  scheduleGathererStartupCatchUp(config);
  scheduleGathererSnapshotHistoryStartupCatchUp(config);
}

// Suggestions For Features and Additions Later:
// - Skip run if last run was within N minutes (already enforced at trigger time)
// - Expose today's planned schedule on dashboard API
// - Alert/webhook when snapshot history import fails after retry
