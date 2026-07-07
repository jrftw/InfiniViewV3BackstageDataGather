/**
 * Filename: parseWorkbookPerformanceColumns.ts
 * Purpose: Resolve Creator Data export headers onto InfiniView system field names via shared alias catalog.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Dependencies: gathererBackstageFieldAliasCatalog, logger, parseWorkbook types
 * Platform Compatibility: Node.js 18+
 */

import { logDebug, logInfo, logWarn } from "../logging/logger";
import { ParsedBackstageRow } from "./parseWorkbook";
import {
  GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES,
  gathererBackstageFieldApplyUnifiedCreatorDataL30dPeriodFallbackRemap,
  gathererBackstageFieldDetectColumnMap,
  gathererBackstageFieldIsUnifiedCreatorDataHybridExport,
  gathererBackstageFieldMissingCriticalCreatorDataFields,
  gathererBackstageFieldRemapRowToParseTargets,
  GathererBackstageFieldColumnMap,
} from "./gathererBackstageFieldAliasCatalog";

const PARSE_WORKBOOK_PERFORMANCE_COLUMNS_SOURCE = "parseWorkbookPerformanceColumns";

// MARK: - Types (backward-compatible exports)

export type ParseWorkbookPerformanceColumnMap = {
  total_diamonds: string | null;
  live_duration: string | null;
  valid_go_live_days: string | null;
  data_period: string | null;
};

export const PARSE_WORKBOOK_PERFORMANCE_CANONICAL_FIELDS = [
  "total_diamonds",
  "live_duration",
  "valid_go_live_days",
  "data_period",
] as const;

function parseWorkbookPerformanceColumnsToLegacyMap(
  columnMap: GathererBackstageFieldColumnMap
): ParseWorkbookPerformanceColumnMap {
  return {
    total_diamonds: columnMap.total_diamonds ?? null,
    live_duration: columnMap.live_duration_total_hours ?? null,
    valid_go_live_days: columnMap.valid_live_days_total ?? null,
    data_period: columnMap.performance_data_period ?? null,
  };
}

// MARK: - Row Remap

export function parseWorkbookPerformanceColumnsRemapRows(
  rows: ParsedBackstageRow[],
  normalizedHeaders: string[],
  rawHeaders: string[]
): ParseWorkbookPerformanceColumnMap {
  let systemColumnMap = gathererBackstageFieldDetectColumnMap(
    normalizedHeaders,
    GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES
  );

  for (const row of rows) {
    gathererBackstageFieldRemapRowToParseTargets(
      row,
      systemColumnMap,
      GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES
    );
  }

  if (gathererBackstageFieldIsUnifiedCreatorDataHybridExport(normalizedHeaders, systemColumnMap)) {
    systemColumnMap = gathererBackstageFieldApplyUnifiedCreatorDataL30dPeriodFallbackRemap(
      rows,
      normalizedHeaders,
      systemColumnMap
    );
    logWarn(
      "Unified Creator Data export profile detected — mapped L30D-labeled columns to calendar-month totals (URL date range). True L30D still comes from Manage creators export.",
      PARSE_WORKBOOK_PERFORMANCE_COLUMNS_SOURCE,
      { rawHeaders }
    );
  }

  const legacyColumnMap = parseWorkbookPerformanceColumnsToLegacyMap(systemColumnMap);

  logInfo(
    `Performance column map — total_diamonds=${legacyColumnMap.total_diamonds ?? "MISSING"}, live_duration=${legacyColumnMap.live_duration ?? "MISSING"}, valid_go_live_days=${legacyColumnMap.valid_go_live_days ?? "MISSING"}, data_period=${legacyColumnMap.data_period ?? "MISSING"}`,
    PARSE_WORKBOOK_PERFORMANCE_COLUMNS_SOURCE,
    { rawHeaderSample: rawHeaders.slice(0, 24), systemFieldMap: systemColumnMap }
  );

  if (!legacyColumnMap.total_diamonds) {
    logWarn(
      "Creator Data export missing Total Diamonds column — add alias in gathererBackstageFieldAliasCatalog.ts or verify Backstage Customize data columns",
      PARSE_WORKBOOK_PERFORMANCE_COLUMNS_SOURCE,
      { rawHeaders }
    );
  }

  logDebug(
    `Remapped Creator Data columns to InfiniView system field keys for ${rows.length} rows`,
    PARSE_WORKBOOK_PERFORMANCE_COLUMNS_SOURCE
  );

  return legacyColumnMap;
}

export function parseWorkbookPerformanceColumnsMissingCriticalFields(
  columnMap: ParseWorkbookPerformanceColumnMap
): string[] {
  const systemColumnMap: GathererBackstageFieldColumnMap = {
    total_diamonds: columnMap.total_diamonds,
    live_duration_total_hours: columnMap.live_duration,
    valid_live_days_total: columnMap.valid_go_live_days,
    performance_data_period: columnMap.data_period,
  };

  return gathererBackstageFieldMissingCriticalCreatorDataFields(systemColumnMap);
}

// Suggestions For Features and Additions Later:
// - Log which Backstage header was chosen for each system field on every run
