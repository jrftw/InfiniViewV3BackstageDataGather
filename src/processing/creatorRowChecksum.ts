/**
 * Filename: creatorRowChecksum.ts
 * Purpose: Stable row checksum over creator data only (excludes import/sync/system fields).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: crypto, normalizeCreatorForCache
 * Platform Compatibility: Node.js 18+
 */

import crypto from "crypto";
import { CombinedCreatorRecord } from "./mergeBackstageReports";
import { normalizeCreatorPhoneForStorage } from "./normalizeCreatorForCache";

// MARK: - Excluded Fields

/** Import/sync/cache/system fields — must not affect row_checksum. */
export const CREATOR_ROW_CHECKSUM_EXCLUDED_FIELDS: readonly (keyof CombinedCreatorRecord)[] = [
  "row_checksum",
  "import_run_id",
  "imported_at",
  "source_performance_file",
  "source_management_file",
  "match_method",
  "schema_version",
  "last_successful_sync_at",
  "last_sync_status",
  "last_sync_error",
  "last_cache_published_at",
  "cache_record_version",
  "warnings",
] as const;

// MARK: - Checksum Builder

function creatorRowChecksumNormalizeValue(
  key: keyof CombinedCreatorRecord,
  value: unknown
): unknown {
  if (key === "phone") {
    return normalizeCreatorPhoneForStorage(value as string | null);
  }
  if (Array.isArray(value)) {
    return [...value].sort();
  }
  return value;
}

export function buildCreatorRowChecksum(creator: CombinedCreatorRecord): string {
  const payload: Record<string, unknown> = {};
  const keys = (Object.keys(creator) as (keyof CombinedCreatorRecord)[]).sort();

  for (const key of keys) {
    if ((CREATOR_ROW_CHECKSUM_EXCLUDED_FIELDS as readonly string[]).includes(key)) {
      continue;
    }
    payload[key] = creatorRowChecksumNormalizeValue(key, creator[key]);
  }

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

// Suggestions For Features and Additions Later:
// - Compare checksums across runs to populate Sync_Log rows_changed accurately
