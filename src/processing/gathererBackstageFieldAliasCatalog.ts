/**
 * Filename: gathererBackstageFieldAliasCatalog.ts
 * Purpose: Single source of truth — map any Backstage export header variant to InfiniView system field names.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Dependencies: none
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Types

export type GathererBackstageFieldValueKind = "string" | "diamonds" | "duration_hours" | "days";

export interface GathererBackstageFieldAliasDefinition {
  /** InfiniView system field used in MongoDB, Google Sheets, cache, and Unified App. */
  systemFieldName: string;
  /** Normalized row key written during parse remap (defaults to first alias). */
  parseTargetRowKey: string;
  /** Normalized Excel row keys checked in priority order during merge. */
  backstageRowKeyAliases: string[];
  /** Fuzzy header detection when exact alias is absent from the export. */
  headerIncludePatterns: RegExp[];
  headerExcludePatterns: RegExp[];
  valueKind: GathererBackstageFieldValueKind;
}

export interface GathererBackstageFieldColumnMap {
  [systemFieldName: string]: string | null;
}

// MARK: - Creator Data (performance export) — period totals

export const GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES: GathererBackstageFieldAliasDefinition[] = [
  {
    systemFieldName: "total_diamonds",
    parseTargetRowKey: "total_diamonds",
    backstageRowKeyAliases: [
      "total_diamonds",
      "totaldiamonds",
      "total_diamond",
      "diamonds",
      "diamonds_total",
      "diamonds_this_month",
      "monthly_diamonds",
      "diamonds_in_selected_period",
      "diamonds_in_period",
      "diamonds_in_current_period",
      "selected_period_diamonds",
    ],
    headerIncludePatterns: [/diamond/, /^diamonds$/],
    headerExcludePatterns: [/l30d/, /last30/, /last_30/, /fan/, /match/, /multi/, /guest/, /prior/, /bonus/, /incentive/],
    valueKind: "diamonds",
  },
  {
    systemFieldName: "live_duration_total_hours",
    parseTargetRowKey: "live_duration",
    backstageRowKeyAliases: [
      "live_duration",
      "liveduration",
      "live_duration_total",
      "total_live_duration",
      "live_duration_hours",
      "live_duration_in_selected_period",
      "live_duration_in_period",
    ],
    headerIncludePatterns: [/live.*duration/, /^duration$/],
    headerExcludePatterns: [/l30d/, /last30/, /last_30/, /prior/],
    valueKind: "duration_hours",
  },
  {
    systemFieldName: "valid_live_days_total",
    parseTargetRowKey: "valid_go_live_days",
    backstageRowKeyAliases: [
      "valid_go_live_days",
      "validgolivedays",
      "valid_live_days",
      "valid_live_days_total",
      "valid_go_live_days_total",
      "valid_go_live_days_in_selected_period",
      "valid_go_live_days_in_period",
    ],
    headerIncludePatterns: [/valid.*live.*day/, /valid.*go.*live/, /valid.*day/],
    headerExcludePatterns: [/l30d/, /last30/, /last_30/, /prior/],
    valueKind: "days",
  },
  {
    systemFieldName: "performance_data_period",
    parseTargetRowKey: "data_period",
    backstageRowKeyAliases: [
      "data_period",
      "dataperiod",
      "performance_data_period",
      "date_range",
      "daterange",
      "selected_period",
      "selectedperiod",
      "reporting_period",
      "reportingperiod",
      "time_period",
    ],
    headerIncludePatterns: [/data.*period/, /date.*range/, /selected.*period/, /time.*period/],
    headerExcludePatterns: [],
    valueKind: "string",
  },
];

// MARK: - Manage Creators export — L30D metrics

export const GATHERER_BACKSTAGE_MANAGE_CREATORS_FIELD_ALIASES: GathererBackstageFieldAliasDefinition[] = [
  {
    systemFieldName: "diamonds_l30d",
    parseTargetRowKey: "diamonds_l30d",
    backstageRowKeyAliases: [
      "diamonds_l30d",
      "diamonds_in_l30d",
      "diamondsinl30d",
      "diamonds_in_last_30d",
    ],
    headerIncludePatterns: [/diamond.*l30d/, /diamond.*last.*30/],
    headerExcludePatterns: [],
    valueKind: "diamonds",
  },
  {
    systemFieldName: "live_duration_l30d_hours",
    parseTargetRowKey: "live_duration_in_l30d",
    backstageRowKeyAliases: ["live_duration_in_l30d", "livedurationinl30d", "live_duration_l30d"],
    headerIncludePatterns: [/live.*duration.*l30d/, /live.*duration.*last.*30/],
    headerExcludePatterns: [],
    valueKind: "duration_hours",
  },
  {
    systemFieldName: "valid_live_days_l30d",
    parseTargetRowKey: "valid_go_live_days_in_l30d",
    backstageRowKeyAliases: [
      "valid_go_live_days_in_l30d",
      "validgolivedaysinl30d",
      "valid_live_days_l30d",
      "valid_live_days_in_l30d",
    ],
    headerIncludePatterns: [/valid.*live.*day.*l30d/, /valid.*day.*last.*30/],
    headerExcludePatterns: [],
    valueKind: "days",
  },
];

export const GATHERER_BACKSTAGE_ALL_FIELD_ALIASES: GathererBackstageFieldAliasDefinition[] = [
  ...GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES,
  ...GATHERER_BACKSTAGE_MANAGE_CREATORS_FIELD_ALIASES,
];

// MARK: - Header Normalization

export function gathererBackstageFieldNormalizeHeader(header: string): string {
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_");
}

export function gathererBackstageFieldCompactHeaderKey(header: string): string {
  return gathererBackstageFieldNormalizeHeader(header).replace(/_/g, "");
}

function gathererBackstageFieldHeaderMatchesDefinition(
  header: string,
  definition: GathererBackstageFieldAliasDefinition
): boolean {
  const normalized = gathererBackstageFieldNormalizeHeader(header);
  const compact = gathererBackstageFieldCompactHeaderKey(header);

  for (const pattern of definition.headerExcludePatterns) {
    if (pattern.test(normalized) || pattern.test(compact)) {
      return false;
    }
  }

  for (const alias of definition.backstageRowKeyAliases) {
    const aliasCompact = alias.replace(/_/g, "");
    if (normalized === alias || compact === aliasCompact) {
      return true;
    }
  }

  return definition.headerIncludePatterns.some(
    (pattern) => pattern.test(normalized) || pattern.test(compact)
  );
}

// MARK: - Header Detection

export function gathererBackstageFieldDetectHeaderForDefinition(
  normalizedHeaders: string[],
  definition: GathererBackstageFieldAliasDefinition
): string | null {
  for (const alias of definition.backstageRowKeyAliases) {
    if (normalizedHeaders.includes(alias)) {
      return alias;
    }
  }

  for (const header of normalizedHeaders) {
    if (gathererBackstageFieldHeaderMatchesDefinition(header, definition)) {
      return header;
    }
  }

  return null;
}

export function gathererBackstageFieldDetectColumnMap(
  normalizedHeaders: string[],
  definitions: GathererBackstageFieldAliasDefinition[] = GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES
): GathererBackstageFieldColumnMap {
  const columnMap: GathererBackstageFieldColumnMap = {};

  for (const definition of definitions) {
    columnMap[definition.systemFieldName] = gathererBackstageFieldDetectHeaderForDefinition(
      normalizedHeaders,
      definition
    );
  }

  return columnMap;
}

// MARK: - Parse Workbook Alias Export

/** Flat alias map for parseWorkbook.ts expected-column checks. */
export function gathererBackstageFieldBuildParseWorkbookAliasMap(
  definitions: GathererBackstageFieldAliasDefinition[]
): Record<string, string[]> {
  const aliasMap: Record<string, string[]> = {};

  for (const definition of definitions) {
    aliasMap[definition.parseTargetRowKey] = [...definition.backstageRowKeyAliases];
  }

  return aliasMap;
}

// MARK: - Row Field Resolution

export function gathererBackstageFieldResolveRawRowValue(
  row: Record<string, unknown>,
  definition: GathererBackstageFieldAliasDefinition
): unknown {
  for (const key of definition.backstageRowKeyAliases) {
    const value = row[key];
    if (value === null || value === undefined) {
      continue;
    }
    const text = String(value).trim();
    if (text === "" || text === "-") {
      continue;
    }
    return value;
  }
  return null;
}

export function gathererBackstageFieldRemapRowToParseTargets(
  row: Record<string, unknown>,
  columnMap: GathererBackstageFieldColumnMap,
  definitions: GathererBackstageFieldAliasDefinition[] = GATHERER_BACKSTAGE_CREATOR_DATA_FIELD_ALIASES
): void {
  for (const definition of definitions) {
    const detectedHeader = columnMap[definition.systemFieldName];
    if (!detectedHeader) {
      continue;
    }

    const sourceValue = row[detectedHeader];
    if (sourceValue === null || sourceValue === undefined || String(sourceValue).trim() === "") {
      continue;
    }

    const targetKey = definition.parseTargetRowKey;
    const existingValue = row[targetKey];
    if (
      existingValue !== null &&
      existingValue !== undefined &&
      String(existingValue).trim() !== "" &&
      String(existingValue).trim() !== "-"
    ) {
      continue;
    }

    row[targetKey] = sourceValue;
  }
}

export function gathererBackstageFieldMissingCriticalCreatorDataFields(
  columnMap: GathererBackstageFieldColumnMap
): string[] {
  const criticalFields = [
    "total_diamonds",
    "live_duration_total_hours",
    "valid_live_days_total",
  ];

  return criticalFields.filter((fieldName) => !columnMap[fieldName]);
}

// MARK: - Unified Creator Data Export (L30D-labeled period metrics)

/** TikTok hybrid Creator Data export — wide management-style sheet with L30D-labeled period columns. */
export interface GathererBackstageUnifiedCreatorDataL30dPeriodFallbackField {
  systemFieldName: string;
  parseTargetRowKey: string;
  sourceNormalizedHeaders: string[];
}

export const GATHERER_BACKSTAGE_UNIFIED_CREATOR_DATA_L30D_PERIOD_FALLBACK_FIELDS: GathererBackstageUnifiedCreatorDataL30dPeriodFallbackField[] =
  [
    {
      systemFieldName: "total_diamonds",
      parseTargetRowKey: "total_diamonds",
      sourceNormalizedHeaders: ["diamonds_in_l30d", "diamondsinl30d"],
    },
    {
      systemFieldName: "live_duration_total_hours",
      parseTargetRowKey: "live_duration",
      sourceNormalizedHeaders: ["live_duration_in_l30d", "livedurationinl30d"],
    },
    {
      systemFieldName: "valid_live_days_total",
      parseTargetRowKey: "valid_go_live_days",
      sourceNormalizedHeaders: ["valid_go_live_days_in_l30d", "validgolivedaysinl30d"],
    },
  ];

function gathererBackstageFieldIsCreatorDataL30dPeriodFallbackEnabled(): boolean {
  return process.env.GATHERER_CREATOR_DATA_L30D_PERIOD_FALLBACK !== "false";
}

function gathererBackstageFieldFindUnifiedCreatorDataSourceHeader(
  normalizedHeaders: string[],
  sourceNormalizedHeaders: string[]
): string | null {
  for (const sourceHeader of sourceNormalizedHeaders) {
    if (normalizedHeaders.includes(sourceHeader)) {
      return sourceHeader;
    }
  }
  return null;
}

export function gathererBackstageFieldIsUnifiedCreatorDataHybridExport(
  normalizedHeaders: string[],
  columnMap: GathererBackstageFieldColumnMap
): boolean {
  if (gathererBackstageFieldMissingCriticalCreatorDataFields(columnMap).length === 0) {
    return false;
  }

  const hasAllL30dPeriodSources =
    GATHERER_BACKSTAGE_UNIFIED_CREATOR_DATA_L30D_PERIOD_FALLBACK_FIELDS.every((field) =>
      gathererBackstageFieldFindUnifiedCreatorDataSourceHeader(
        normalizedHeaders,
        field.sourceNormalizedHeaders
      )
    );

  if (!hasAllL30dPeriodSources) {
    return false;
  }

  const hasHybridProfileMarkers =
    normalizedHeaders.includes("creators_username") ||
    normalizedHeaders.includes("creator_network_manager") ||
    normalizedHeaders.includes("group") ||
    normalizedHeaders.some((header) => header.includes("management_relationship"));

  return hasHybridProfileMarkers;
}

export function gathererBackstageFieldApplyUnifiedCreatorDataL30dPeriodFallbackRemap(
  rows: Record<string, unknown>[],
  normalizedHeaders: string[],
  columnMap: GathererBackstageFieldColumnMap
): GathererBackstageFieldColumnMap {
  if (!gathererBackstageFieldIsCreatorDataL30dPeriodFallbackEnabled()) {
    return columnMap;
  }

  if (!gathererBackstageFieldIsUnifiedCreatorDataHybridExport(normalizedHeaders, columnMap)) {
    return columnMap;
  }

  const updatedColumnMap: GathererBackstageFieldColumnMap = { ...columnMap };

  for (const fallbackField of GATHERER_BACKSTAGE_UNIFIED_CREATOR_DATA_L30D_PERIOD_FALLBACK_FIELDS) {
    const sourceHeader = gathererBackstageFieldFindUnifiedCreatorDataSourceHeader(
      normalizedHeaders,
      fallbackField.sourceNormalizedHeaders
    );
    if (!sourceHeader) {
      continue;
    }

    updatedColumnMap[fallbackField.systemFieldName] = sourceHeader;

    for (const row of rows) {
      const sourceValue = row[sourceHeader];
      if (sourceValue === null || sourceValue === undefined || String(sourceValue).trim() === "") {
        continue;
      }

      const targetKey = fallbackField.parseTargetRowKey;
      const existingValue = row[targetKey];
      if (
        existingValue !== null &&
        existingValue !== undefined &&
        String(existingValue).trim() !== "" &&
        String(existingValue).trim() !== "-"
      ) {
        continue;
      }

      row[targetKey] = sourceValue;
    }
  }

  return updatedColumnMap;
}

// Suggestions For Features and Additions Later:
// - Share this catalog with Unified App backend parser for parity tests
// - Version alias catalog when Backstage export schema changes
