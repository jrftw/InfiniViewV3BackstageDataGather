/**
 * Filename: scheduler.ts
 * Purpose: Schedule 4 daily gatherer runs in Eastern Time.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: node-cron
 * Platform Compatibility: Node.js 18+
 */

import cron from "node-cron";
import { GathererConfig } from "./config";
import { runGathererJob } from "./jobs/runGathererJob";
import { logInfo, logError } from "./logging/logger";

// MARK: - Cron Helpers

function gathererTimeToCron(time: string): string {
  const [hour, minute] = time.split(":").map((v) => parseInt(v, 10));
  return `${minute} ${hour} * * *`;
}

// MARK: - Start Scheduler

export function startGathererScheduler(config: GathererConfig): void {
  for (const schedule of config.runSchedules) {
    const cronExpr = gathererTimeToCron(schedule);
    cron.schedule(
      cronExpr,
      async () => {
        logInfo(`Scheduled run triggered (${schedule})`, "scheduler");
        const result = await runGathererJob({
          trigger: "scheduled",
          scheduledTime: schedule,
        });
        if (!result.success) {
          logError("Scheduled run failed", "scheduler", { errors: result.errors });
        }
      },
      { timezone: config.timezone }
    );
    logInfo(`Scheduled gatherer at ${schedule} (${config.timezone})`, "scheduler");
  }
}

// Suggestions For Features and Additions Later:
// - Skip run if last run was within N minutes
