/**
 * Filename: gathererProcessPipeline.ts
 * Purpose: Shared merge, filter, CRM enrichment, local output, and Google publish pipeline.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: processing, outputs, logging
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig } from "../config";
import { GathererRunContext } from "./gathererRunContext";
import { parseBackstageWorkbook } from "../processing/parseWorkbook";
import { mergeBackstageReports } from "../processing/mergeBackstageReports";
import { filterActiveCreatorsForOutput } from "../processing/filterActiveCreators";
import { applyManualEnrichmentToCreators } from "../processing/applyManualEnrichment";
import { applyCrmSheetEnrichmentToCreators } from "../processing/applyCrmSheetEnrichment";
import { applyDipSheetEnrichmentToCreators } from "../processing/applyDipSheetEnrichment";
import { applyCreatorSystemMetadataToCreators } from "../processing/applyCreatorSystemMetadata";
import { publishCreatorJsonCache } from "../cache/publishCreatorCache";
import { SyncLogAppendRow } from "../google/syncSheetTabs";
import { buildCombinedOutputFiles } from "../processing/buildOutputs";
import { buildImportSummary, ImportSummaryData } from "../logging/importSummary";
import {
  publishToAllOutputTargets,
  loadManualEnrichmentIfConfigured,
  loadCrmSheetEnrichmentIfConfigured,
  loadDipSheetEnrichmentIfConfigured,
} from "../outputs/outputTargets";
import { validateGathererExportFiles } from "./validateRun";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { readMasterCreatorsSheet } from "../google/readMasterCreatorsSheet";
import { preserveMasterProfileFieldsOnCreators } from "../processing/preserveMasterProfileFields";
import { logDebug, logWarn } from "../logging/logger";
import {
  gathererLogInfo,
  gathererLogOk,
  gathererLogProgress,
  gathererLogWarn,
  gathererLogWorking,
} from "../logging/friendlyLog";

// MARK: - Pipeline Input / Output

export interface GathererProcessPipelineInput {
  config: GathererConfig;
  runContext: GathererRunContext;
  runId: string;
  startedAt: string;
  performanceFile: string;
  managementFile: string;
  progressStepOffset?: number;
  progressStepTotal?: number;
}

export interface GathererEnrichmentStats {
  manualAppliedCount: number;
  crmAppliedCount: number;
  crmSkippedMismatchCount: number;
  crmRowCount: number;
  dipAppliedCount: number;
  dipSkippedMismatchCount: number;
  dipRowCount: number;
  appliedCount: number;
}

export interface GathererProcessPipelineResult {
  creators: CombinedCreatorRecord[];
  summary: ImportSummaryData;
  summaryPath: string;
  publishResult: Awaited<ReturnType<typeof publishToAllOutputTargets>>;
  enrichmentStats: GathererEnrichmentStats;
}

// MARK: - Enrichment

export async function applyGathererCreatorEnrichment(
  config: GathererConfig,
  activeCreators: CombinedCreatorRecord[]
): Promise<{ creators: CombinedCreatorRecord[]; stats: GathererEnrichmentStats }> {
  const enrichmentRows = await loadManualEnrichmentIfConfigured(config);
  const { creators: manualEnrichedCreators, appliedCount: manualAppliedCount } =
    applyManualEnrichmentToCreators(activeCreators, enrichmentRows);

  const crmRows = await loadCrmSheetEnrichmentIfConfigured(config);

  if (!config.googleCrmSheetId) {
    gathererLogWarn(
      "CRM enrichment",
      "GOOGLE_CRM_SHEET_ID not set in .env — save the file and re-run (email/phone/DIP skipped)"
    );
    gathererLogInfo(
      "CRM config",
      `Loaded from ${config.projectRoot}\\.env — CRM ID is empty at runtime`
    );
  } else {
    gathererLogInfo("CRM sheet ID", config.googleCrmSheetId);
    if (crmRows.length === 0) {
      gathererLogWarn(
        "CRM enrichment",
        "no rows loaded — share CRM sheet with service account or check tab/columns"
      );
    }
  }

  const {
    creators: crmEnrichedCreators,
    appliedCount: crmAppliedCount,
    skippedMismatchCount: crmSkippedMismatchCount,
  } = applyCrmSheetEnrichmentToCreators(manualEnrichedCreators, crmRows);

  const dipRows = await loadDipSheetEnrichmentIfConfigured(config);

  if (!config.googleDipSheetId) {
    gathererLogWarn(
      "DIP enrichment",
      "GOOGLE_DIP_SHEET_ID not set in .env — Diamond Incentive fields skipped"
    );
  } else {
    gathererLogInfo("DIP sheet ID", config.googleDipSheetId);
    if (dipRows.length === 0) {
      gathererLogWarn(
        "DIP enrichment",
        "no rows loaded — share DIP sheet with service account or check tab/gid/columns"
      );
    }
  }

  const {
    creators,
    appliedCount: dipAppliedCount,
    skippedMismatchCount: dipSkippedMismatchCount,
  } = applyDipSheetEnrichmentToCreators(crmEnrichedCreators, dipRows);

  const appliedCount = manualAppliedCount + crmAppliedCount + dipAppliedCount;

  if (crmAppliedCount > 0) {
    gathererLogOk(
      "CRM enrichment",
      `${crmAppliedCount} creators updated from external sheet` +
        (crmSkippedMismatchCount > 0
          ? ` · ${crmSkippedMismatchCount} cid/username mismatches skipped`
          : "")
    );
  }

  if (dipAppliedCount > 0) {
    gathererLogOk(
      "DIP enrichment",
      `${dipAppliedCount} creators updated from Diamond Incentive sheet` +
        (dipSkippedMismatchCount > 0
          ? ` · ${dipSkippedMismatchCount} cid/username mismatches skipped`
          : "")
    );
  }

  return {
    creators,
    stats: {
      manualAppliedCount,
      crmAppliedCount,
      crmSkippedMismatchCount,
      crmRowCount: crmRows.length,
      dipAppliedCount,
      dipSkippedMismatchCount,
      dipRowCount: dipRows.length,
      appliedCount,
    },
  };
}

// MARK: - Full Pipeline

export async function runGathererProcessPipeline(
  input: GathererProcessPipelineInput
): Promise<GathererProcessPipelineResult> {
  const {
    config,
    runContext,
    runId,
    startedAt,
    performanceFile,
    managementFile,
    progressStepOffset = 2,
    progressStepTotal = 5,
  } = input;

  const step = (n: number, label: string) =>
    gathererLogProgress(progressStepOffset + n - 2, progressStepTotal, label);

  step(2, "Validating and parsing Excel files");
  const validation = validateGathererExportFiles(performanceFile, managementFile);
  if (validation.warnings.length > 0) {
    for (const warning of validation.warnings) {
      logDebug(warning, "gathererProcessPipeline");
      gathererLogWarn("Validation note", warning);
    }
  }
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }
  gathererLogOk("Excel files validated");

  step(3, "Merging reports by Creator ID");
  const perfParsed = parseBackstageWorkbook(performanceFile, "performance");
  const mgmtParsed = parseBackstageWorkbook(managementFile, "management");

  const mergeResult = mergeBackstageReports(
    perfParsed.rows,
    mgmtParsed.rows,
    runId,
    startedAt,
    performanceFile,
    managementFile,
    { timezone: config.timezone, referenceDate: new Date(startedAt) }
  );

  const filterResult = filterActiveCreatorsForOutput(mergeResult.combined, {
    requireManagementMatch: config.gathererRequireManagementMatch,
    requireEffectiveRelationship: config.gathererRequireEffectiveRelationship,
    excludeGraduationStatusTerms: config.gathererExcludeGraduationStatuses,
  });

  if (filterResult.excludedCount > 0) {
    gathererLogOk(
      "Inactive creators filtered",
      `${filterResult.excludedCount} removed · ${filterResult.activeCreators.length} active remain`
    );
  }

  const { creators: enrichedCreators, stats: enrichmentStats } = await applyGathererCreatorEnrichment(
    config,
    filterResult.activeCreators
  );

  let creatorsForOutput = enrichedCreators;
  if (config.googleMasterSheetId) {
    try {
      const masterCreators = await readMasterCreatorsSheet(config);
      creatorsForOutput = preserveMasterProfileFieldsOnCreators(enrichedCreators, masterCreators);
      if (masterCreators.length > 0) {
        gathererLogOk(
          "Profile snapshot preserve",
          `kept TikTok public profile fields from master for existing creators`
        );
      }
    } catch (error) {
      logWarn(
        `Could not preserve profile fields from master sheet: ${error instanceof Error ? error.message : String(error)}`,
        "gathererProcessPipeline"
      );
    }
  }

  const syncedAt = new Date().toISOString();

  const creatorsWithChecksum = applyCreatorSystemMetadataToCreators(creatorsForOutput, {
    runId,
    syncedAt,
    syncSuccess: true,
  });

  const cacheResult = publishCreatorJsonCache(config, creatorsWithChecksum, runId);
  gathererLogOk(
    "JSON cache published",
    `${cacheResult.rowsWritten} updated · ${cacheResult.rowsSkipped} unchanged · ${cacheResult.indexPath}`
  );

  const creators = applyCreatorSystemMetadataToCreators(creatorsForOutput, {
    runId,
    syncedAt,
    syncSuccess: true,
    cachePublishedAtByCreatorId: cacheResult.cachePublishedAtByCreatorId,
  });

  const syncLogRow: SyncLogAppendRow = {
    runId,
    runType: runContext.runTrigger === "scheduled" ? "gatherer_scheduled" : "gatherer_manual",
    startedAt,
    finishedAt: new Date().toISOString(),
    status: "success",
    rowsRead: creatorsForOutput.length,
    rowsChanged: cacheResult.rowsWritten,
    rowsFailed:
      enrichmentStats.crmSkippedMismatchCount + enrichmentStats.dipSkippedMismatchCount,
    warningsCount:
      mergeResult.duplicateWarnings.length +
      (filterResult.excludedCount > 0 ? 1 : 0) +
      (mergeResult.unmatchedPerformance.length > 0 ? 1 : 0),
    errorSummary: "",
    sourceFile: `${performanceFile}; ${managementFile}`,
    createdBy: "infiniview-gatherer",
  };

  gathererLogOk(
    "Merge complete",
    `${creators.length} creators · ${enrichmentStats.appliedCount} enrichment rows applied`
  );

  if (mergeResult.unmatchedPerformance.length > 0 || mergeResult.unmatchedManagement.length > 0) {
    gathererLogWarn(
      "Unmatched rows",
      `${mergeResult.unmatchedPerformance.length} performance · ${mergeResult.unmatchedManagement.length} management`
    );
  }

  step(4, "Saving local combined files");

  let summary = buildImportSummary({
    runId,
    startedAt,
    performanceRowCount: perfParsed.rows.length,
    managementRowCount: mgmtParsed.rows.length,
    combinedCreatorCount: creators.length,
    excludedCreatorCount: filterResult.excludedCount,
    excludedCreatorsByReason: filterResult.excludedByReason,
    unmatchedPerformanceCount: mergeResult.unmatchedPerformance.length,
    unmatchedManagementCount: mergeResult.unmatchedManagement.length,
    enrichmentAppliedCount: enrichmentStats.appliedCount,
    crmEnrichmentAppliedCount: enrichmentStats.crmAppliedCount,
    crmEnrichmentSkippedMismatches: enrichmentStats.crmSkippedMismatchCount,
    dipEnrichmentAppliedCount: enrichmentStats.dipAppliedCount,
    dipEnrichmentSkippedMismatches: enrichmentStats.dipSkippedMismatchCount,
    duplicateWarnings: mergeResult.duplicateWarnings,
    errors: [],
    outputFiles: [],
    driveUploaded: false,
    sheetsUpdated: false,
    runTrigger: runContext.runTrigger,
    scheduledSlotIndex: runContext.scheduledSlotIndex,
    scheduledSlotTotal: runContext.scheduledSlotTotal,
    isDailyFinalRun: runContext.isDailyFinalRun,
    dailyDateKey: runContext.dailyDateKey,
    dailySheetTabName: runContext.dailySheetTabName,
  });

  const outputPaths = buildCombinedOutputFiles(
    config.localProcessedDir,
    runContext.dailyOutputBaseName,
    creators,
    summary
  );

  gathererLogOk("Local files saved", runContext.dailyOutputBaseName);

  const allLocalFiles = [
    performanceFile,
    managementFile,
    outputPaths.combinedXlsx,
    outputPaths.combinedCsv,
    outputPaths.combinedJson,
    outputPaths.importSummaryJson,
    cacheResult.indexPath,
  ];

  step(5, "Updating Google Sheet, Drive, and MongoDB");
  gathererLogWorking("Publishing outputs");

  const publishResult = await publishToAllOutputTargets({
    config,
    runContext,
    creators,
    performanceRows: perfParsed.rows,
    managementRows: mgmtParsed.rows,
    unmatchedPerformance: mergeResult.unmatchedPerformance,
    unmatchedManagement: mergeResult.unmatchedManagement,
    summary,
    allLocalFiles,
    syncLog: syncLogRow,
  });

  summary = buildImportSummary({
    ...summary,
    finishedAt: new Date().toISOString(),
    success: true,
    outputFiles: allLocalFiles,
    driveUploaded: publishResult.driveUploaded,
    sheetsUpdated: publishResult.sheetsUpdated,
    mongoPublished: publishResult.mongoPublished,
    mongoCreatorsUpserted: publishResult.mongoCreatorsUpserted,
    mongoSnapshotsInserted: publishResult.mongoSnapshotsInserted,
  });

  return {
    creators,
    summary,
    summaryPath: outputPaths.importSummaryJson,
    publishResult,
    enrichmentStats,
  };
}

// Suggestions For Features and Additions Later:
// - Enrichment-only mode that skips raw tab rewrites on master sheet
