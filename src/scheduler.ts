/**
 * Filename: scheduler.ts
 * Purpose: Schedule gatherer runs — fixed times or randomized daily plan with jitter.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-25
 * Dependencies: node-cron, gathererSchedulePlanner
 * Platform Compatibility: Node.js 18+
 */

import cron, { ScheduledTask } from "node-cron";
import { GathererConfig } from "./config";
import { runGathererJob } from "./jobs/runGathererJob";
import { getGathererMinutesSinceLastRunStarted } from "./jobs/runState";
import { logInfo, logError } from "./logging/logger";
import {
  GathererPlannedRun,
  gathererFilterFuturePlannedRuns,
  planGathererDailyRuns,
} from "./scheduler/gathererSchedulePlanner";

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
    gathererScheduleMidnightReschedule(config);
  }, delayMs);
}

// MARK: - Start Scheduler

export function startGathererScheduler(config: GathererConfig): void {
  gathererScheduleRunsForToday(config);
  gathererScheduleMidnightReschedule(config);
}

// Suggestions For Features and Additions Later:
// - Skip run if last run was within N minutes (already enforced at trigger time)
// - Expose today's planned schedule on dashboard API
