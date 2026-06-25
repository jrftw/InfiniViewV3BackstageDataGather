/**
 * Filename: publishCreatorCache.ts
 * Purpose: Write fast-read JSON cache files for InfiniView (index, by-id, by-username).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Dependencies: fs, path
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import path from "path";
import { GathererConfig } from "../config";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { GATHERER_CREATOR_SCHEMA_VERSION } from "../constants/gathererSchemaVersion";
import { gathererEnsureDir } from "../utils/files";
import { normalizeCreatorRecordForCache } from "../processing/normalizeCreatorForCache";
import { logInfo } from "../logging/logger";

// MARK: - Result Type

export interface PublishCreatorCacheResult {
  publishedAt: string;
  indexPath: string;
  creatorCount: number;
  rowsWritten: number;
  rowsSkipped: number;
  cachePublishedAtByCreatorId: Record<string, string>;
}

// MARK: - Index Helpers

interface PublishCreatorCacheIndexEntry {
  backstage_creator_id: string | null;
  tiktok_username: string | null;
  normalized_username: string | null;
  row_checksum: string | null;
  cache_record_version: string | null;
}

function publishCreatorCacheSafeFilename(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function publishCreatorCacheLoadExistingChecksumById(
  indexPath: string
): Map<string, string> {
  const checksumById = new Map<string, string>();

  if (!fs.existsSync(indexPath)) {
    return checksumById;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as {
      creators?: Array<{ backstage_creator_id?: string | null; row_checksum?: string | null }>;
    };

    for (const entry of raw.creators ?? []) {
      const creatorId = entry.backstage_creator_id?.trim();
      const checksum = entry.row_checksum?.trim();
      if (creatorId && checksum) {
        checksumById.set(creatorId, checksum);
      }
    }
  } catch {
    return checksumById;
  }

  return checksumById;
}

function publishCreatorCacheReadExistingPublishedAt(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
      last_cache_published_at?: string | null;
    };
    return raw.last_cache_published_at ?? null;
  } catch {
    return null;
  }
}

function publishCreatorCacheShouldWriteRow(
  creatorId: string,
  rowChecksum: string,
  existingChecksumById: Map<string, string>,
  idFilePath: string
): boolean {
  if (!fs.existsSync(idFilePath)) {
    return true;
  }

  const existingChecksum = existingChecksumById.get(creatorId);
  if (!existingChecksum) {
    return true;
  }

  return existingChecksum !== rowChecksum;
}

// MARK: - Cache Writer

export function publishCreatorJsonCache(
  config: GathererConfig,
  creators: CombinedCreatorRecord[],
  runId: string
): PublishCreatorCacheResult {
  const publishedAt = new Date().toISOString();
  const cacheRoot = config.localCacheDir;
  const byIdDir = path.join(cacheRoot, "by-id");
  const byUsernameDir = path.join(cacheRoot, "by-username");
  const indexPath = path.join(cacheRoot, "index.json");

  gathererEnsureDir(cacheRoot);
  gathererEnsureDir(byIdDir);
  gathererEnsureDir(byUsernameDir);

  const existingChecksumById = publishCreatorCacheLoadExistingChecksumById(indexPath);
  const cachePublishedAtByCreatorId: Record<string, string> = {};
  const indexEntries: PublishCreatorCacheIndexEntry[] = [];
  let rowsWritten = 0;
  let rowsSkipped = 0;

  for (const creator of creators) {
    const cacheCreator = normalizeCreatorRecordForCache(creator);
    const creatorId = cacheCreator.backstage_creator_id?.trim() ?? "";
    const rowChecksum = cacheCreator.row_checksum ?? "";

    indexEntries.push({
      backstage_creator_id: cacheCreator.backstage_creator_id,
      tiktok_username: cacheCreator.tiktok_username,
      normalized_username: cacheCreator.normalized_username,
      row_checksum: cacheCreator.row_checksum,
      cache_record_version: cacheCreator.cache_record_version ?? cacheCreator.row_checksum,
    });

    if (!creatorId || !rowChecksum) {
      continue;
    }

    const idFile = path.join(byIdDir, `${publishCreatorCacheSafeFilename(creatorId)}.json`);
    const shouldWrite = publishCreatorCacheShouldWriteRow(
      creatorId,
      rowChecksum,
      existingChecksumById,
      idFile
    );

    if (shouldWrite) {
      const cacheRecord = {
        ...cacheCreator,
        last_cache_published_at: publishedAt,
      };
      fs.writeFileSync(idFile, JSON.stringify(cacheRecord, null, 2), "utf-8");
      cachePublishedAtByCreatorId[creatorId] = publishedAt;
      rowsWritten++;

      const usernameKey = cacheCreator.normalized_username ?? cacheCreator.tiktok_username;
      if (usernameKey) {
        const usernameFile = path.join(
          byUsernameDir,
          `${publishCreatorCacheSafeFilename(usernameKey)}.json`
        );
        fs.writeFileSync(usernameFile, JSON.stringify(cacheRecord, null, 2), "utf-8");
      }
    } else {
      const preservedPublishedAt =
        publishCreatorCacheReadExistingPublishedAt(idFile) ?? publishedAt;
      cachePublishedAtByCreatorId[creatorId] = preservedPublishedAt;
      rowsSkipped++;
    }
  }

  const indexPayload = {
    schema_version: GATHERER_CREATOR_SCHEMA_VERSION,
    generated_at: publishedAt,
    run_id: runId,
    creator_count: creators.length,
    rows_written: rowsWritten,
    rows_skipped: rowsSkipped,
    creators: indexEntries,
  };

  fs.writeFileSync(indexPath, JSON.stringify(indexPayload, null, 2), "utf-8");

  logInfo(
    `Published creator JSON cache: ${rowsWritten} written, ${rowsSkipped} unchanged → ${indexPath}`,
    "publishCreatorCache"
  );

  return {
    publishedAt,
    indexPath,
    creatorCount: creators.length,
    rowsWritten,
    rowsSkipped,
    cachePublishedAtByCreatorId,
  };
}

// Suggestions For Features and Additions Later:
// - Upload cache folder to Google Drive for remote InfiniView reads
