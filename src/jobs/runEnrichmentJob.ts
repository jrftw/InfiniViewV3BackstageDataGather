/**
 * Filename: runEnrichmentJob.ts
 * Purpose: Reprocess latest local raw exports + CRM enrichment without Backstage browser export.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: gathererProcessPipeline, findLatestRawExports
 * Platform Compatibility: Node.js 18+ (Windows server PC)
 */

import { loadGathererConfig } from "../config";
import { logInfo, logError } from "../logging/logger";
import { gathererGenerateRunId } from "../utils/dates";
import { gathererEnsureDir } from "../utils/files";
import { cleanupOldLocalGathererFiles } from "./cleanupOldLocalFiles";
import {
  acquireGathererRunLock,
  releaseGathererRunLock,
  setGathererLastSummary,
} from "./runState";
import { buildGathererRunContext } from "./gathererRunContext";
import { findLatestGathererRawExportPair } from "./findLatestRawExports";
import { runGathererProcessPipeline } from "./gathererProcessPipeline";
import { runGathererPreflightCheck } from "./preflightCheck";
import {
  gathererLogBanner,
  gathererLogDone,
  gathererLogFatal,
  gathererLogInfo,
  gathererLogOk,
  gathererLogSection,
  gathererLogWarn,
} from "../logging/friendlyLog";

// MARK: - Enrichment Job Result

export interface GathererEnrichmentJobResult {
  success: boolean;
  summaryPath?: string;
  errors: string[];
}

// MARK: - Run Enrichment Job

export async function runEnrichmentJob(): Promise<GathererEnrichmentJobResult> {
  if (!acquireGathererRunLock()) {
    gathererLogFatal("Another gatherer run is already in progress");
    return { success: false, errors: ["A gatherer run is already in progress"] };
  }

  const config = loadGathererConfig();
  const runContext = buildGathererRunContext(config, { trigger: "manual" });
  const runId = gathererGenerateRunId();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  gathererEnsureDir(config.localRawDir);
  gathererEnsureDir(config.localProcessedDir);

  if (process.env.GATHERER_SKIP_PREFLIGHT !== "true") {
    const preflight = await runGathererPreflightCheck(config);
    if (!preflight.ok) {
      releaseGathererRunLock();
      return { success: false, errors: preflight.blockingErrors };
    }
  }

  gathererLogBanner(
    "InfiniView V3 — Enrichment Only",
    "Reprocessing latest raw exports + CRM + DIP sheets (no Backstage browser)"
  );
  gathererLogInfo("Run ID", runId);

  try {
    gathererLogSection("Latest raw exports");
    const exportPair = findLatestGathererRawExportPair(config.localRawDir);

    if (!exportPair) {
      throw new Error(
        `No paired raw exports found in ${config.localRawDir}. Run npm run gather first.`
      );
    }

    gathererLogOk("Using raw export pair", exportPair.exportTimestampKey);
    gathererLogInfo("Performance file", exportPair.performanceFile);
    gathererLogInfo("Management file", exportPair.managementFile);

    const pipelineResult = await runGathererProcessPipeline({
      config,
      runContext,
      runId,
      startedAt,
      performanceFile: exportPair.performanceFile,
      managementFile: exportPair.managementFile,
      progressStepOffset: 1,
      progressStepTotal: 4,
    });

    if (pipelineResult.publishResult.sheetsUpdated) {
      gathererLogOk("Google Sheet updated", "01_Latest_Master_Creators");
    } else {
      gathererLogWarn("Google Sheet", "not updated — check Google config");
    }

    setGathererLastSummary(pipelineResult.summary);
    cleanupOldLocalGathererFiles(config);

    logInfo(
      `Enrichment job completed: ${pipelineResult.creators.length} creators, CRM ${pipelineResult.enrichmentStats.crmAppliedCount}, DIP ${pipelineResult.enrichmentStats.dipAppliedCount}`,
      "runEnrichmentJob"
    );

    gathererLogDone(
      "Enrichment completed successfully",
      `${pipelineResult.enrichmentStats.crmAppliedCount} CRM · ${pipelineResult.enrichmentStats.dipAppliedCount} DIP · ${pipelineResult.creators.length} creators`
    );

    return {
      success: true,
      summaryPath: pipelineResult.summaryPath,
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    logError("Enrichment job failed", "runEnrichmentJob", { error: message });
    gathererLogFatal("Enrichment job failed", message);
    return { success: false, errors };
  } finally {
    releaseGathererRunLock();
  }
}

// MARK: - CLI Entry

async function runEnrichmentJobCliMain(): Promise<void> {
  const result = await runEnrichmentJob();
  if (!result.success) {
    gathererLogFatal("Enrichment failed", result.errors.join("; "));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runEnrichmentJobCliMain();
}

// Suggestions For Features and Additions Later:
// - --timestamp=2026-06-24-1431 flag to pick a specific raw export pair
