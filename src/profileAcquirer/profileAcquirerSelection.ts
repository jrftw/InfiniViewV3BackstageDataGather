/**
 * Filename: profileAcquirerSelection.ts
 * Purpose: Choose which creator rows the profile acquirer should process per run mode.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: mergeBackstageReports, normalizeUsername
 * Platform Compatibility: Node.js 18+
 */

import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { normalizeTikTokUsername } from "../processing/normalizeUsername";

// MARK: - Types

export type ProfileAcquirerRunMode = "batch" | "signup" | "login" | "post_backstage";

export interface ProfileAcquirerSelectionOptions {
  mode: ProfileAcquirerRunMode;
  normalizedUsernames?: string[];
  staleHours: number;
  newOnly: boolean;
  forceRefresh: boolean;
  usernameChanged: boolean;
  batchLimit: number;
}

export interface ProfileAcquirerSelectionResult {
  selected: CombinedCreatorRecord[];
  skippedMissingUsername: number;
  skippedFresh: number;
  skippedLimit: number;
}

// MARK: - Helpers

function profileAcquirerSelectionParseCheckedAt(raw: string | null | undefined): number | null {
  if (!raw || !String(raw).trim()) {
    return null;
  }
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : null;
}

function profileAcquirerSelectionIsStale(
  creator: CombinedCreatorRecord,
  staleHours: number,
  forceRefresh: boolean
): boolean {
  if (forceRefresh) {
    return true;
  }
  const checkedAt = profileAcquirerSelectionParseCheckedAt(creator.profile_snapshot_last_checked_at);
  if (checkedAt === null) {
    return true;
  }
  const staleMs = staleHours * 60 * 60 * 1000;
  return Date.now() - checkedAt >= staleMs;
}

function profileAcquirerSelectionIsNew(creator: CombinedCreatorRecord): boolean {
  return profileAcquirerSelectionParseCheckedAt(creator.profile_snapshot_last_checked_at) === null;
}

function profileAcquirerSelectionMatchesUsernameFilter(
  creator: CombinedCreatorRecord,
  normalizedUsernames: string[] | undefined
): boolean {
  if (!normalizedUsernames || normalizedUsernames.length === 0) {
    return true;
  }
  const username = creator.normalized_username ?? normalizeTikTokUsername(creator.tiktok_username);
  if (!username) {
    return false;
  }
  const filterSet = new Set(normalizedUsernames.map((value) => value.trim().toLowerCase()).filter(Boolean));
  return filterSet.has(username);
}

// MARK: - Selection Engine

export function profileAcquirerSelectCreators(
  creators: CombinedCreatorRecord[],
  options: ProfileAcquirerSelectionOptions
): ProfileAcquirerSelectionResult {
  let skippedMissingUsername = 0;
  let skippedFresh = 0;
  let skippedLimit = 0;

  const eligible: CombinedCreatorRecord[] = [];

  for (const creator of creators) {
    const normalizedUsername =
      creator.normalized_username ?? normalizeTikTokUsername(creator.tiktok_username);

    if (!normalizedUsername) {
      skippedMissingUsername += 1;
      continue;
    }

    if (!profileAcquirerSelectionMatchesUsernameFilter(creator, options.normalizedUsernames)) {
      continue;
    }

    if (options.mode === "signup") {
      eligible.push({ ...creator, normalized_username: normalizedUsername });
      continue;
    }

    if (options.mode === "login") {
      const shouldRefresh =
        options.forceRefresh ||
        options.usernameChanged ||
        profileAcquirerSelectionIsStale(creator, options.staleHours, false);

      if (shouldRefresh) {
        eligible.push({ ...creator, normalized_username: normalizedUsername });
      } else {
        skippedFresh += 1;
      }
      continue;
    }

    if (options.mode === "post_backstage" && options.newOnly && !profileAcquirerSelectionIsNew(creator)) {
      skippedFresh += 1;
      continue;
    }

    if (
      options.mode === "batch" &&
      !profileAcquirerSelectionIsStale(creator, options.staleHours, options.forceRefresh)
    ) {
      skippedFresh += 1;
      continue;
    }

    if (
      options.mode === "post_backstage" &&
      !options.newOnly &&
      !profileAcquirerSelectionIsStale(creator, options.staleHours, options.forceRefresh)
    ) {
      skippedFresh += 1;
      continue;
    }

    eligible.push({ ...creator, normalized_username: normalizedUsername });
  }

  const limit = Math.max(1, options.batchLimit);
  const selected = eligible.slice(0, limit);
  skippedLimit = Math.max(0, eligible.length - selected.length);

  return {
    selected,
    skippedMissingUsername,
    skippedFresh,
    skippedLimit,
  };
}

// Suggestions For Features and Additions Later:
// - Priority queue for failed/blocked profiles with exponential backoff
// - Login mode: compare portal-stored username hash vs sheet when InfiniView passes portal_user_id
