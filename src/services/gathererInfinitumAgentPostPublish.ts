/**
 * Filename: gathererInfinitumAgentPostPublish.ts
 * Purpose: Optional post-publish InfinitumServerAgent hooks after a successful gatherer run.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Dependencies: config, infinitumServerAgentClient, logger
 * Platform Compatibility: Node.js 18+
 *
 * Used by: runGathererJob after Google Sheet/Drive/Mongo publish completes.
 * Failures are logged as warnings only — the gatherer run remains successful.
 */

import { GathererConfig, gathererIsInfinitumAgentEnabled } from "../config";
import { GathererRunContext } from "../jobs/gathererRunContext";
import { logInfo, logWarn } from "../logging/logger";
import {
  gathererInfinitumServerAgentClientRunMongoSummarySync,
  gathererInfinitumServerAgentClientRunSnapshotImport,
} from "./infinitumServerAgentClient";

const GATHERER_INFINITUM_AGENT_POST_PUBLISH_SOURCE = "gathererInfinitumAgentPostPublish";

// MARK: Types

export interface GathererInfinitumAgentPostPublishInput {
  config: GathererConfig;
  runContext: GathererRunContext;
  runId: string;
  driveUploaded: boolean;
}

export interface GathererInfinitumAgentPostPublishResult {
  attempted: boolean;
  job: "snapshot-import" | "mongo-summary-sync" | "none";
  success: boolean;
  error?: string;
}

// MARK: Post-Publish Hook

export async function gathererInfinitumAgentRunPostPublishHooks(
  input: GathererInfinitumAgentPostPublishInput
): Promise<GathererInfinitumAgentPostPublishResult> {
  const { config, runContext, runId, driveUploaded } = input;

  if (!gathererIsInfinitumAgentEnabled(config)) {
    return {
      attempted: false,
      job: "none",
      success: true,
    };
  }

  const shouldRunSnapshotImport = runContext.isDailyFinalRun && driveUploaded;
  const job: GathererInfinitumAgentPostPublishResult["job"] = shouldRunSnapshotImport
    ? "snapshot-import"
    : "mongo-summary-sync";

  logInfo(
    `InfinitumServerAgent post-publish hook starting (${job})`,
    GATHERER_INFINITUM_AGENT_POST_PUBLISH_SOURCE,
    {
      runId,
      dailyDateKey: runContext.dailyDateKey,
      isDailyFinalRun: runContext.isDailyFinalRun,
      driveUploaded,
    }
  );

  const agentResult = shouldRunSnapshotImport
    ? await gathererInfinitumServerAgentClientRunSnapshotImport(config, {
        snapshotDate: runContext.dailyDateKey,
        runId,
        trigger: runContext.runTrigger,
      })
    : await gathererInfinitumServerAgentClientRunMongoSummarySync(config);

  if (!agentResult.enabled) {
    return {
      attempted: false,
      job: "none",
      success: true,
    };
  }

  if (agentResult.success) {
    logInfo(
      `InfinitumServerAgent post-publish hook succeeded (${job})`,
      GATHERER_INFINITUM_AGENT_POST_PUBLISH_SOURCE,
      { runId, statusCode: agentResult.statusCode }
    );
    return {
      attempted: true,
      job,
      success: true,
    };
  }

  const warningMessage =
    agentResult.error ??
    `InfinitumServerAgent ${job} failed after successful gather/publish`;

  logWarn(
    `InfinitumServerAgent post-publish hook failed (${job}) — gatherer run still succeeded`,
    GATHERER_INFINITUM_AGENT_POST_PUBLISH_SOURCE,
    {
      runId,
      error: warningMessage,
      statusCode: agentResult.statusCode,
    }
  );

  return {
    attempted: true,
    job,
    success: false,
    error: warningMessage,
  };
}

// Suggestions For Features and Additions Later:
// - Trigger backup job on a separate nightly schedule via agent
// - Retry agent hooks with exponential backoff without blocking gatherer lock
// - Expose post-publish agent status in /api/status and last-run-summary.json
