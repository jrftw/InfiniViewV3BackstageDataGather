/**
 * Filename: gathererBackstageExportShapeValidator.ts
 * Purpose: Detect whether a downloaded Creator Data xlsx matches classic analytics vs hybrid/wrong export shape.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Dependencies: parseWorkbook, gathererBackstageFieldAliasCatalog
 * Platform Compatibility: Node.js 18+
 */

import { parseBackstageWorkbook } from "./parseWorkbook";
import { gathererBackstageFieldIsUnifiedCreatorDataHybridExport } from "./gathererBackstageFieldAliasCatalog";
import { gathererBackstageFieldDetectColumnMap } from "./gathererBackstageFieldAliasCatalog";
import { GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES } from "./gathererBackstageFieldAliasCatalog";

// MARK: - Types

export type GathererBackstageCreatorDataExportProfile =
  | "classic_analytics"
  | "hybrid_l30d_labeled"
  | "invalid";

export interface GathererBackstageCreatorDataExportShapeResult {
  profile: GathererBackstageCreatorDataExportProfile;
  valid: boolean;
  rawHeaders: string[];
  columnMap: Record<string, string | null>;
  missingCritical: string[];
}

// MARK: - Profile Detection

export function gathererBackstageExportShapeValidateCreatorDataFile(
  filePath: string
): GathererBackstageCreatorDataExportShapeResult {
  const parsed = parseBackstageWorkbook(filePath, "performance");
  const systemColumnMap = gathererBackstageFieldDetectColumnMap(
    parsed.headers,
    GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES
  );

  const hasDataPeriod = parsed.headers.includes("data_period");
  const hasClassicDiamonds =
    systemColumnMap.total_diamonds === "diamonds" ||
    systemColumnMap.total_diamonds === "total_diamonds" ||
    systemColumnMap.total_diamonds === "diamonds_in_selected_period";

  const missingCritical = parsed.missingColumns.filter((column) =>
    ["total_diamonds", "live_duration", "valid_go_live_days"].includes(column)
  );

  const isHybrid = gathererBackstageFieldIsUnifiedCreatorDataHybridExport(
    parsed.headers,
    systemColumnMap
  );

  let profile: GathererBackstageCreatorDataExportProfile = "invalid";

  if (hasDataPeriod && hasClassicDiamonds && parsed.performanceColumnMap?.total_diamonds) {
    profile = "classic_analytics";
  } else if (isHybrid && parsed.performanceColumnMap?.total_diamonds) {
    profile = "hybrid_l30d_labeled";
  }

  const valid = profile === "classic_analytics";

  return {
    profile,
    valid,
    rawHeaders: parsed.rawHeaders,
    columnMap: {
      total_diamonds: parsed.performanceColumnMap?.total_diamonds ?? null,
      live_duration: parsed.performanceColumnMap?.live_duration ?? null,
      valid_go_live_days: parsed.performanceColumnMap?.valid_go_live_days ?? null,
      data_period: parsed.performanceColumnMap?.data_period ?? null,
    },
    missingCritical: parsed.missingColumns.filter((column) =>
      ["total_diamonds", "live_duration", "valid_go_live_days"].includes(column)
    ),
  };
}

// Suggestions For Features and Additions Later:
// - Compare automated vs manual export row counts before merge
// - Emit metrics when hybrid profile is used for alerting
