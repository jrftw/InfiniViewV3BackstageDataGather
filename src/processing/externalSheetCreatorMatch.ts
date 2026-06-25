/**
 * Filename: externalSheetCreatorMatch.ts
 * Purpose: Shared cid + userId matching for external Google Sheet enrichment rows.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Platform Compatibility: Node.js 18+
 */

import { normalizeBackstageCreatorId } from "./normalizeCreatorId";
import { normalizeTikTokUsername } from "./normalizeUsername";
import { CombinedCreatorRecord } from "./mergeBackstageReports";

// MARK: - Types

export interface ExternalSheetCreatorMatchRow {
  backstage_creator_id: string | null;
  tiktok_username: string | null;
}

// MARK: - Match Helpers

export function externalSheetCreatorMatchUsername(
  creator: CombinedCreatorRecord
): string | null {
  return creator.normalized_username ?? normalizeTikTokUsername(creator.tiktok_username);
}

export function externalSheetCreatorMatchRowUsername(
  row: ExternalSheetCreatorMatchRow
): string | null {
  return normalizeTikTokUsername(row.tiktok_username);
}

export function externalSheetCreatorMatchRowCreatorId(
  row: ExternalSheetCreatorMatchRow
): string | null {
  return normalizeBackstageCreatorId(row.backstage_creator_id);
}

/** True when CRM/Backstage ids match exactly or one is a truncated Excel/Sheet export. */
export function externalSheetCreatorIdsCompatible(
  rowCid: string,
  creatorCid: string
): boolean {
  if (rowCid === creatorCid) {
    return true;
  }
  if (rowCid.startsWith(creatorCid) || creatorCid.startsWith(rowCid)) {
    return true;
  }
  const prefixLength = Math.min(10, rowCid.length, creatorCid.length);
  if (prefixLength >= 8 && rowCid.slice(0, prefixLength) === creatorCid.slice(0, prefixLength)) {
    return true;
  }
  return false;
}

/**
 * Match priority:
 * 1) Exact cid match (userId may differ between Backstage and CRM)
 * 2) Username match when cids absent, compatible, or CRM cid is truncated
 */
export function externalSheetCreatorRowMatchesCreator(
  row: ExternalSheetCreatorMatchRow,
  creator: CombinedCreatorRecord
): boolean {
  const rowCid = externalSheetCreatorMatchRowCreatorId(row);
  const rowUser = externalSheetCreatorMatchRowUsername(row);
  const creatorCid = creator.backstage_creator_id;
  const creatorUser = externalSheetCreatorMatchUsername(creator);

  if (rowCid && creatorCid && rowCid === creatorCid) {
    return true;
  }

  if (rowUser && creatorUser && rowUser === creatorUser) {
    if (!rowCid || !creatorCid) {
      return true;
    }
    if (externalSheetCreatorIdsCompatible(rowCid, creatorCid)) {
      return true;
    }
    // CRM sheets sometimes store shortened cids — trust username when CRM cid is short
    if (rowCid.length < 12) {
      return true;
    }
    return false;
  }

  return false;
}

export function externalSheetCreatorFindMatchingRow<T extends ExternalSheetCreatorMatchRow>(
  creator: CombinedCreatorRecord,
  byCreatorId: Map<string, T>,
  byUsername: Map<string, T>
): T | undefined {
  const creatorCid = creator.backstage_creator_id;
  const creatorUser = externalSheetCreatorMatchUsername(creator);

  if (creatorCid && byCreatorId.has(creatorCid)) {
    return byCreatorId.get(creatorCid);
  }
  if (creatorUser && byUsername.has(creatorUser)) {
    return byUsername.get(creatorUser);
  }
  return undefined;
}

// Suggestions For Features and Additions Later:
// - Fuzzy username match with confidence score for external sheets
