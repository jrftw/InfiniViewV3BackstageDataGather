/**
 * Filename: preserveMasterProfileFields.ts
 * Purpose: Keep TikTok profile acquirer fields from master sheet when Backstage gather overwrites rows.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: mergeBackstageReports, profileAcquirerWritableFields
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "./mergeBackstageReports";
import { normalizeTikTokUsername } from "./normalizeUsername";
import {
  PROFILE_ACQUIRER_WRITABLE_FIELDS,
  ProfileAcquirerWritableField,
} from "../profileAcquirer/profileAcquirerWritableFields";
import { logDebug } from "../logging/logger";

// MARK: - Match Keys

function preserveMasterProfileFieldsMatchKey(creator: CombinedCreatorRecord): string | null {
  const creatorId = creator.backstage_creator_id?.trim();
  if (creatorId) {
    return `id:${creatorId}`;
  }
  const username =
    creator.normalized_username ?? normalizeTikTokUsername(creator.tiktok_username);
  if (username) {
    return `user:${username}`;
  }
  return null;
}

function preserveMasterProfileFieldsHasStoredValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

// MARK: - Preserve Engine

export function preserveMasterProfileFieldsOnCreators(
  incomingCreators: CombinedCreatorRecord[],
  masterCreators: CombinedCreatorRecord[]
): CombinedCreatorRecord[] {
  const masterByKey = new Map<string, CombinedCreatorRecord>();

  for (const masterCreator of masterCreators) {
    const key = preserveMasterProfileFieldsMatchKey(masterCreator);
    if (key) {
      masterByKey.set(key, masterCreator);
    }
  }

  let preservedCount = 0;

  const merged = incomingCreators.map((incoming) => {
    const key = preserveMasterProfileFieldsMatchKey(incoming);
    if (!key) {
      return incoming;
    }

    const master = masterByKey.get(key);
    if (!master) {
      return incoming;
    }

    const next: CombinedCreatorRecord = { ...incoming };
    let copiedAny = false;

    for (const field of PROFILE_ACQUIRER_WRITABLE_FIELDS) {
      const masterValue = master[field as ProfileAcquirerWritableField];
      if (preserveMasterProfileFieldsHasStoredValue(masterValue)) {
        (next as Record<string, unknown>)[field] = masterValue;
        copiedAny = true;
      }
    }

    if (copiedAny) {
      preservedCount += 1;
    }

    return next;
  });

  logDebug(
    `Preserved profile acquirer fields for ${preservedCount}/${incomingCreators.length} creators`,
    "preserveMasterProfileFields"
  );

  return merged;
}

// Suggestions For Features and Additions Later:
// - Preserve only when incoming profile_snapshot_last_checked_at is older than master
