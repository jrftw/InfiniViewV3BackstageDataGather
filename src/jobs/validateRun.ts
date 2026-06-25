/**
 * Filename: validateRun.ts
 * Purpose: Validate exported files exist and have expected structure.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import {
  parseBackstageWorkbook,
  parseWorkbookHasCreatorIdentifier,
} from "../processing/parseWorkbook";
import { logInfo } from "../logging/logger";

// MARK: - Validation Result

export interface GathererValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// MARK: - Validate Run Files

export function validateGathererExportFiles(
  performanceFile: string,
  managementFile: string
): GathererValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(performanceFile)) {
    errors.push(`Performance file missing: ${performanceFile}`);
  }
  if (!fs.existsSync(managementFile)) {
    errors.push(`Management file missing: ${managementFile}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const perfStats = fs.statSync(performanceFile);
  const mgmtStats = fs.statSync(managementFile);

  if (perfStats.size < 100) {
    errors.push("Performance file appears empty or corrupt");
  }
  if (mgmtStats.size < 100) {
    errors.push("Management file appears empty or corrupt");
  }

  try {
    const perf = parseBackstageWorkbook(performanceFile, "performance");
    const mgmt = parseBackstageWorkbook(managementFile, "management");

    if (perf.rows.length === 0) {
      errors.push("Performance export has zero data rows");
    }
    if (mgmt.rows.length === 0) {
      errors.push("Management export has zero data rows");
    }

    if (!parseWorkbookHasCreatorIdentifier(perf.headers)) {
      errors.push(
        `Performance export has no Creator/Creator ID column. Found: ${perf.rawHeaders.slice(0, 8).join(", ")}`
      );
    }
    if (!parseWorkbookHasCreatorIdentifier(mgmt.headers)) {
      errors.push(
        `Management export has no Creator/Creator ID column. Found: ${mgmt.rawHeaders.slice(0, 8).join(", ")}`
      );
    }

    if (perf.missingColumns.length > 0) {
      warnings.push(`Performance optional columns not matched: ${perf.missingColumns.join(", ")}`);
    }
    if (mgmt.missingColumns.length > 0) {
      warnings.push(`Management optional columns not matched: ${mgmt.missingColumns.join(", ")}`);
    }

    logInfo(
      `Validated exports — performance: ${perf.rows.length} rows, management: ${mgmt.rows.length} rows`,
      "validateRun",
      { perfWarnings: perf.missingColumns, mgmtWarnings: mgmt.missingColumns }
    );
  } catch (error) {
    errors.push(
      `Parse error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

// Suggestions For Features and Additions Later:
// - Row count minimum thresholds
