/**
 * Filename: importSummary.ts
 * Purpose: Build import summary metadata for each gatherer run.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Import Summary Type

export interface ImportSummaryData {
  runId: string;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  performanceRowCount: number;
  managementRowCount: number;
  combinedCreatorCount: number;
  excludedCreatorCount?: number;
  excludedCreatorsByReason?: Record<string, number>;
  unmatchedPerformanceCount: number;
  unmatchedManagementCount: number;
  enrichmentAppliedCount: number;
  crmEnrichmentAppliedCount?: number;
  crmEnrichmentSkippedMismatches?: number;
  dipEnrichmentAppliedCount?: number;
  dipEnrichmentSkippedMismatches?: number;
  duplicateWarnings: string[];
  errors: string[];
  outputFiles: string[];
  driveUploaded: boolean;
  sheetsUpdated: boolean;
  runTrigger?: string;
  scheduledSlotIndex?: number | null;
  scheduledSlotTotal?: number;
  isDailyFinalRun?: boolean;
  dailyDateKey?: string;
  dailySheetTabName?: string;
}

// MARK: - Summary Builder

export function buildImportSummary(
  partial: Omit<ImportSummaryData, "finishedAt" | "success"> & {
    finishedAt?: string;
    success?: boolean;
    errors?: string[];
  }
): ImportSummaryData {
  return {
    runId: partial.runId,
    startedAt: partial.startedAt,
    finishedAt: partial.finishedAt ?? new Date().toISOString(),
    success: partial.success ?? (partial.errors ?? []).length === 0,
    performanceRowCount: partial.performanceRowCount,
    managementRowCount: partial.managementRowCount,
    combinedCreatorCount: partial.combinedCreatorCount,
    excludedCreatorCount: partial.excludedCreatorCount,
    excludedCreatorsByReason: partial.excludedCreatorsByReason,
    unmatchedPerformanceCount: partial.unmatchedPerformanceCount,
    unmatchedManagementCount: partial.unmatchedManagementCount,
    enrichmentAppliedCount: partial.enrichmentAppliedCount,
    crmEnrichmentAppliedCount: partial.crmEnrichmentAppliedCount,
    crmEnrichmentSkippedMismatches: partial.crmEnrichmentSkippedMismatches,
    dipEnrichmentAppliedCount: partial.dipEnrichmentAppliedCount,
    dipEnrichmentSkippedMismatches: partial.dipEnrichmentSkippedMismatches,
    duplicateWarnings: partial.duplicateWarnings,
    errors: partial.errors ?? [],
    outputFiles: partial.outputFiles,
    driveUploaded: partial.driveUploaded,
    sheetsUpdated: partial.sheetsUpdated,
  };
}

// Suggestions For Features and Additions Later:
// - Persist last summary path for dashboard
