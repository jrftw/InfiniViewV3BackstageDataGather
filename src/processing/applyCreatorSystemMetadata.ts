/**
 * Filename: applyCreatorSystemMetadata.ts
 * Purpose: Apply schema version, checksum, and sync metadata to creator rows before publish.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: gathererSchemaVersion, creatorRowChecksum
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "./mergeBackstageReports";
import { GATHERER_CREATOR_SCHEMA_VERSION } from "../constants/gathererSchemaVersion";
import { buildCreatorRowChecksum } from "./creatorRowChecksum";

// MARK: - Input

export interface ApplyCreatorSystemMetadataInput {
  runId: string;
  syncedAt: string;
  syncSuccess: boolean;
  syncError?: string | null;
  /** Set only for rows whose cache file was written this run; preserves prior timestamps otherwise. */
  cachePublishedAtByCreatorId?: Record<string, string>;
}

// MARK: - Apply Metadata

export function applyCreatorSystemMetadataToCreators(
  creators: CombinedCreatorRecord[],
  input: ApplyCreatorSystemMetadataInput
): CombinedCreatorRecord[] {
  const syncStatus = input.syncSuccess ? "success" : "failed";
  const syncError = input.syncSuccess ? null : (input.syncError ?? "unknown error");

  return creators.map((creator) => {
    const rowChecksum = buildCreatorRowChecksum(creator);
    const creatorId = creator.backstage_creator_id ?? "";
    const cachePublishedAt =
      input.cachePublishedAtByCreatorId?.[creatorId] ?? creator.last_cache_published_at;

    return {
      ...creator,
      schema_version: GATHERER_CREATOR_SCHEMA_VERSION,
      row_checksum: rowChecksum,
      cache_record_version: rowChecksum,
      last_successful_sync_at: input.syncSuccess ? input.syncedAt : creator.last_successful_sync_at,
      last_sync_status: syncStatus,
      last_sync_error: syncError,
      last_cache_published_at: cachePublishedAt ?? null,
    };
  });
}

// Suggestions For Features and Additions Later:
// - Compare row_checksum across runs to populate Sync_Log rows_changed accurately
