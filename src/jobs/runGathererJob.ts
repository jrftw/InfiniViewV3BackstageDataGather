/**
 * Filename: runGathererJob.ts
 * Purpose: Main gatherer job — export, merge, enrich, output.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: All gatherer modules
 * Platform Compatibility: Node.js 18+ (Windows server PC)
 */

import { loadGathererConfig } from "../config";
import { logInfo, logError } from "../logging/logger";
import { gathererFormatRunTimestamp, gathererGenerateRunId } from "../utils/dates";
import { gathererEnsureDir } from "../utils/files";
import { runBackstageExports } from "../backstage/backstageExportRunner";
import { runGathererProcessPipeline } from "./gathererProcessPipeline";
import { runProfileAcquirerJob } from "./runProfileAcquirerJob";
import { buildImportSummary } from "../logging/importSummary";
import { cleanupOldLocalGathererFiles } from "./cleanupOldLocalFiles";
import {
  acquireGathererRunLock,
  releaseGathererRunLock,
  setGathererLastSummary,
} from "./runState";
import {
  buildGathererRunContext,
  GathererJobOptions,
} from "./gathererRunContext";
import { runGathererPreflightCheck } from "./preflightCheck";
import {
  gathererLogBanner,
  gathererLogDone,
  gathererLogFatal,
  gathererLogInfo,
  gathererLogOk,
  gathererLogProgress,
  gathererLogSection,
  gathererLogWarn,
  gathererLogWorking,
} from "../logging/friendlyLog";

// MARK: - Job Result

export interface GathererJobResult {
  success: boolean;
  summaryPath?: string;
  errors: string[];
}

// MARK: - Run Gatherer Job

export async function runGathererJob(
  options: GathererJobOptions = {}
): Promise<GathererJobResult> {
  if (!acquireGathererRunLock()) {
    gathererLogFatal("Another gatherer run is already in progress");
    return { success: false, errors: ["A gatherer run is already in progress"] };
  }

  const config = loadGathererConfig();
  const runContext = buildGathererRunContext(config, options);
  const runId = gathererGenerateRunId();
  const startedAt = new Date().toISOString();
  const exportTimestamp = gathererFormatRunTimestamp();
  const errors: string[] = [];

  gathererEnsureDir(config.localRawDir);
  gathererEnsureDir(config.localProcessedDir);
  gathererEnsureDir(config.localLogDir);

  const slotLabel =
    runContext.scheduledSlotIndex !== null
      ? `scheduled ${runContext.scheduledSlotIndex}/${runContext.scheduledSlotTotal}`
      : "manual";

  if (process.env.GATHERER_SKIP_PREFLIGHT !== "true") {
    const preflight = await runGathererPreflightCheck(config);
    if (!preflight.ok) {
      releaseGathererRunLock();
      return {
        success: false,
        errors: preflight.blockingErrors,
      };
    }
  }

  gathererLogBanner(
    "InfiniView V3 Backstage Gatherer — Run Started",
    `${slotLabel} · day sheet ${runContext.dailySheetTabName}${runContext.isDailyFinalRun ? " · daily final" : ""}`
  );
  gathererLogInfo("Run ID", runId);

  logInfo(
    `Gatherer run started: ${runId} (${slotLabel}, day sheet ${runContext.dailySheetTabName}, daily final: ${runContext.isDailyFinalRun})`,
    "runGathererJob"
  );

  let jobResult: GathererJobResult = { success: false, errors: [] };
  let shouldChainProfileAcquirer = false;

  try {
    gathererLogSection("Backstage browser exports");
    gathererLogProgress(1, 5, "Exporting management + performance reports from Backstage");
    gathererLogWorking("Launching browser — this may take a minute");

    const { performanceFile, managementFile } = await runBackstageExports(
      config,
      exportTimestamp
    );

    gathererLogOk("Backstage exports downloaded");
    gathererLogInfo("Management file", managementFile);
    gathererLogInfo("Performance file", performanceFile);

    const pipelineResult = await runGathererProcessPipeline({
      config,
      runContext,
      runId,
      startedAt,
      performanceFile,
      managementFile,
    });

    const { creators, summary: pipelineSummary, publishResult } = pipelineResult;
    let summary = pipelineSummary;

    if (publishResult.sheetsUpdated) {
      gathererLogOk("Google Sheet updated", runContext.dailySheetTabName);
    } else {
      gathererLogInfo("Google Sheet", "skipped or not configured");
    }

    if (publishResult.driveUploaded) {
      if (publishResult.dailyArchiveUrl) {
        gathererLogOk("Daily archive Google Sheet saved", publishResult.dailyArchiveUrl);
      } else {
        gathererLogOk("Google Drive daily archive uploaded");
      }
    } else if (runContext.isDailyFinalRun) {
      gathererLogWarn("Google Drive", "daily archive not uploaded — check folder share");
    } else {
      gathererLogInfo("Google Drive", "intraday run — daily archive runs at final slot near GATHERER_DAILY_ARCHIVE_TIME");
    }

    if (publishResult.mongoPublished) {
      gathererLogOk(
        "MongoDB updated",
        `${publishResult.mongoCreatorsUpserted} creators · ${publishResult.mongoSnapshotsInserted} snapshots`
      );
    } else {
      gathererLogInfo("MongoDB", "skipped or not configured");
    }

    setGathererLastSummary(summary);
    cleanupOldLocalGathererFiles(config);

    logInfo(
      `Gatherer run completed: ${creators.length} creators (${runContext.dailySheetTabName}${runContext.isDailyFinalRun ? ", daily archive uploaded" : ", intraday update"})`,
      "runGathererJob"
    );

    gathererLogDone(
      "Gatherer run completed successfully",
      `${creators.length} creators → ${runContext.dailySheetTabName}`
    );

    jobResult = {
      success: true,
      summaryPath: pipelineResult.summaryPath,
      errors: [],
    };
    shouldChainProfileAcquirer =
      config.profileAcquirerEnabled && config.profileAcquirerRunAfterBackstage;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    logError("Gatherer run failed", "runGathererJob", { error: message });
    gathererLogFatal("Gatherer run failed", message);

    const failedSummary = buildImportSummary({
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      success: false,
      performanceRowCount: 0,
      managementRowCount: 0,
      combinedCreatorCount: 0,
      unmatchedPerformanceCount: 0,
      unmatchedManagementCount: 0,
      enrichmentAppliedCount: 0,
      duplicateWarnings: [],
      errors,
      outputFiles: [],
      driveUploaded: false,
      sheetsUpdated: false,
      mongoPublished: false,
      runTrigger: runContext.runTrigger,
      scheduledSlotIndex: runContext.scheduledSlotIndex,
      scheduledSlotTotal: runContext.scheduledSlotTotal,
      isDailyFinalRun: runContext.isDailyFinalRun,
      dailyDateKey: runContext.dailyDateKey,
      dailySheetTabName: runContext.dailySheetTabName,
    });

    setGathererLastSummary(failedSummary);
    jobResult = { success: false, errors };
  } finally {
    releaseGathererRunLock();
  }

  if (shouldChainProfileAcquirer) {
    gathererLogSection("TikTok Public Profile Acquirer (optional chain)");
    gathererLogInfo(
      "Chaining profile acquirer",
      "post_backstage · new creators only when GATHERER_PROFILE_ACQUIRER_AFTER_BACKSTAGE_NEW_ONLY=true"
    );
    const profileResult = await runProfileAcquirerJob({ trigger: "post_backstage" });
    if (!profileResult.success && profileResult.errors.length > 0) {
      gathererLogWarn("Profile acquirer chain", profileResult.errors.join("; "));
    }
  }

  return jobResult;
}

// MARK: - CLI Entry

async function runGathererJobCliMain(): Promise<void> {
  const result = await runGathererJob({ trigger: "manual" });
  if (!result.success) {
    gathererLogFatal("Gatherer failed", result.errors.join("; "));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runGathererJobCliMain();
}

// Suggestions For Features and Additions Later:
// - Dry-run mode using existing local files
