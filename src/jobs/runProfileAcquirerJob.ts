/**
 * Filename: runProfileAcquirerJob.ts
 * Purpose: Phase 2 job — TikTok Public Profile Acquirer (separate from Backstage gather runs).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-26
 * Dependencies: readMasterCreatorsSheet, publishMasterCreatorsTab, profile acquirer modules
 * Platform Compatibility: Node.js 18+ (Windows server PC)
 */

import { loadGathererConfig } from "../config";
import { logInfo, logError } from "../logging/logger";
import { gathererGenerateRunId } from "../utils/dates";
import { gathererEnsureDir, gathererWriteJsonFile } from "../utils/files";
import {
  acquireGathererRunLock,
  releaseGathererRunLock,
} from "./runState";
import { readMasterCreatorsSheet } from "../google/readMasterCreatorsSheet";
import { publishMasterCreatorsTab } from "../google/publishMasterCreatorsTab";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { normalizeTikTokUsername } from "../processing/normalizeUsername";
import {
  profileAcquirerSelectCreators,
  ProfileAcquirerRunMode,
} from "../profileAcquirer/profileAcquirerSelection";
import { tiktokPublicProfileCollectorGather } from "../profileAcquirer/tiktokPublicProfileCollector";
import { profileAcquirerMergeSnapshotIntoCreator } from "../profileAcquirer/profileAcquirerMergeSnapshot";
import { publishCreatorJsonCache } from "../cache/publishCreatorCache";
import {
  gathererLogBanner,
  gathererLogDone,
  gathererLogFatal,
  gathererLogInfo,
  gathererLogOk,
  gathererLogProgress,
  gathererLogSection,
  gathererLogWarn,
  gathererLogWorking,
} from "../logging/friendlyLog";

// MARK: - Job Options / Result

export type ProfileAcquirerJobTrigger =
  | "manual"
  | "signup"
  | "login"
  | "post_backstage"
  | "scheduled";

export interface ProfileAcquirerJobOptions {
  trigger?: ProfileAcquirerJobTrigger;
  normalizedUsernames?: string[];
  forceRefresh?: boolean;
  /** InfiniView sets true when the creator changed TikTok username since last profile check. */
  usernameChanged?: boolean;
}

export interface ProfileAcquirerJobResult {
  success: boolean;
  runId: string;
  processedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
  summaryPath?: string;
}

export interface ProfileAcquirerJobSummary {
  runId: string;
  trigger: ProfileAcquirerJobTrigger;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  processedCount: number;
  updatedCount: number;
  skippedMissingUsername: number;
  skippedFresh: number;
  skippedLimit: number;
  errors: string[];
  usernames: string[];
}

// MARK: - Creator Index Helpers

function runProfileAcquirerJobMatchKey(creator: CombinedCreatorRecord): string | null {
  const creatorId = creator.backstage_creator_id?.trim();
  if (creatorId) {
    return `id:${creatorId}`;
  }
  const username =
    creator.normalized_username ?? normalizeTikTokUsername(creator.tiktok_username);
  return username ? `user:${username}` : null;
}

function runProfileAcquirerJobApplyUpdatedCreators(
  allCreators: CombinedCreatorRecord[],
  updatedCreators: CombinedCreatorRecord[]
): CombinedCreatorRecord[] {
  const updatedByKey = new Map<string, CombinedCreatorRecord>();
  for (const creator of updatedCreators) {
    const key = runProfileAcquirerJobMatchKey(creator);
    if (key) {
      updatedByKey.set(key, creator);
    }
  }

  return allCreators.map((creator) => {
    const key = runProfileAcquirerJobMatchKey(creator);
    if (!key) {
      return creator;
    }
    return updatedByKey.get(key) ?? creator;
  });
}

function runProfileAcquirerJobResolveMode(trigger: ProfileAcquirerJobTrigger): ProfileAcquirerRunMode {
  if (trigger === "signup") {
    return "signup";
  }
  if (trigger === "login") {
    return "login";
  }
  if (trigger === "post_backstage") {
    return "post_backstage";
  }
  return "batch";
}

function runProfileAcquirerJobIsSingleCreatorTrigger(trigger: ProfileAcquirerJobTrigger): boolean {
  return trigger === "signup" || trigger === "login";
}

// MARK: - Run Profile Acquirer Job

export async function runProfileAcquirerJob(
  options: ProfileAcquirerJobOptions = {}
): Promise<ProfileAcquirerJobResult> {
  if (!acquireGathererRunLock()) {
    gathererLogFatal("Another gatherer or profile acquirer run is already in progress");
    return {
      success: false,
      runId: "",
      processedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors: ["A gatherer or profile acquirer run is already in progress"],
    };
  }

  const config = loadGathererConfig();
  const trigger = options.trigger ?? "manual";
  const runId = gathererGenerateRunId();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  if (!config.profileAcquirerEnabled) {
    releaseGathererRunLock();
    return {
      success: false,
      runId,
      processedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors: ["Profile acquirer is disabled (GATHERER_PROFILE_ACQUIRER_ENABLED=false)"],
    };
  }

  gathererEnsureDir(config.localLogDir);
  gathererEnsureDir(config.localCacheDir);

  gathererLogBanner(
    "InfiniView V3 — TikTok Public Profile Acquirer",
    `${trigger} · separate from Backstage gather`
  );
  gathererLogInfo("Run ID", runId);

  if (
    runProfileAcquirerJobIsSingleCreatorTrigger(trigger) &&
    (!options.normalizedUsernames || options.normalizedUsernames.length === 0)
  ) {
    const message = `${trigger} trigger requires normalized_username`;
    gathererLogFatal(message);
    releaseGathererRunLock();
    return {
      success: false,
      runId,
      processedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors: [message],
    };
  }

  try {
    gathererLogSection("Load master creators");
    gathererLogWorking("Reading 01_Latest_Master_Creators from Google Sheet");

    const allCreators = await readMasterCreatorsSheet(config);
    if (allCreators.length === 0) {
      throw new Error(
        "No creators loaded from master sheet. Run Backstage gather first or check GOOGLE_MASTER_SHEET_ID."
      );
    }

    gathererLogOk("Master sheet loaded", `${allCreators.length} creators`);

    const selection = profileAcquirerSelectCreators(allCreators, {
      mode: runProfileAcquirerJobResolveMode(trigger),
      normalizedUsernames: options.normalizedUsernames,
      staleHours: config.profileAcquirerStaleHours,
      newOnly: config.profileAcquirerAfterBackstageNewOnly,
      forceRefresh: options.forceRefresh ?? false,
      usernameChanged: options.usernameChanged ?? false,
      batchLimit: runProfileAcquirerJobIsSingleCreatorTrigger(trigger)
        ? 1
        : config.profileAcquirerBatchLimit,
    });

    if (selection.selected.length === 0) {
      gathererLogWarn(
        "No creators selected",
        `missing username ${selection.skippedMissingUsername} · fresh ${selection.skippedFresh} · limit ${selection.skippedLimit}`
      );
      return {
        success: true,
        runId,
        processedCount: 0,
        updatedCount: 0,
        skippedCount:
          selection.skippedMissingUsername + selection.skippedFresh + selection.skippedLimit,
        errors: [],
      };
    }

    gathererLogOk(
      "Creators queued",
      `${selection.selected.length} selected · fresh skipped ${selection.skippedFresh}`
    );

    gathererLogSection("Collect public TikTok profiles");
    const updatedCreators: CombinedCreatorRecord[] = [];
    const processedUsernames: string[] = [];

    for (let index = 0; index < selection.selected.length; index += 1) {
      const creator = selection.selected[index];
      const username =
        creator.normalized_username ?? normalizeTikTokUsername(creator.tiktok_username);

      if (!username) {
        continue;
      }

      gathererLogProgress(index + 1, selection.selected.length, `@${username}`);

      try {
        const snapshot = await tiktokPublicProfileCollectorGather(config, username, {
          existingProfileImageHash: creator.profile_image_hash,
          existingProfileImageUrl: creator.profile_image_url,
          existingProfileImageSource: creator.profile_image_source,
        });
        const merged = profileAcquirerMergeSnapshotIntoCreator(creator, snapshot);
        updatedCreators.push(merged);
        processedUsernames.push(username);
        gathererLogOk(`@${username}`, snapshot.profileSnapshotStatus);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${username}: ${message}`);
        gathererLogWarn(`@${username}`, message);
      }
    }

    const mergedAllCreators = runProfileAcquirerJobApplyUpdatedCreators(
      allCreators,
      updatedCreators
    );

    gathererLogSection("Publish profile updates");
    gathererLogWorking("Writing profile fields back to master sheet");

    const publishResult = await publishMasterCreatorsTab(config, mergedAllCreators);
    if (publishResult.skippedNoChanges) {
      gathererLogInfo(
        "Google Sheet",
        `no changes — ${publishResult.rowsUnchanged} rows unchanged, tab not rewritten`
      );
    } else if (publishResult.published) {
      gathererLogOk(
        "Google Sheet updated",
        `${publishResult.rowsUpdated} rows updated · ${publishResult.rowsAppended} appended · ${publishResult.rowsUnchanged} unchanged`
      );
    } else {
      gathererLogWarn("Google Sheet", "not updated — check Google config");
    }

    const cacheResult = publishCreatorJsonCache(config, mergedAllCreators, runId);
    if (publishResult.published || publishResult.rowsUpdated > 0) {
      gathererLogOk(
        "JSON cache refreshed",
        `${cacheResult.rowsWritten} updated · ${cacheResult.indexPath}`
      );
    } else {
      gathererLogInfo("JSON cache", `${cacheResult.rowsSkipped} unchanged · no sheet write needed`);
    }

    const finishedAt = new Date().toISOString();
    const summary: ProfileAcquirerJobSummary = {
      runId,
      trigger,
      startedAt,
      finishedAt,
      success: errors.length === 0,
      processedCount: updatedCreators.length,
      updatedCount: updatedCreators.length,
      skippedMissingUsername: selection.skippedMissingUsername,
      skippedFresh: selection.skippedFresh,
      skippedLimit: selection.skippedLimit,
      errors,
      usernames: processedUsernames,
    };

    const summaryPath = `${config.localLogDir}/profile-acquirer-summary-${runId}.json`;
    gathererWriteJsonFile(summaryPath, summary);

    logInfo(
      `Profile acquirer completed: ${updatedCreators.length} creators (${trigger})`,
      "runProfileAcquirerJob"
    );

    gathererLogDone(
      "Profile acquirer completed",
      `${updatedCreators.length} creators updated`
    );

    return {
      success: errors.length === 0,
      runId,
      processedCount: updatedCreators.length,
      updatedCount: updatedCreators.length,
      skippedCount:
        selection.skippedMissingUsername + selection.skippedFresh + selection.skippedLimit,
      errors,
      summaryPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    logError("Profile acquirer failed", "runProfileAcquirerJob", { error: message });
    gathererLogFatal("Profile acquirer failed", message);
    return {
      success: false,
      runId,
      processedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors,
    };
  } finally {
    releaseGathererRunLock();
  }
}

// MARK: - CLI Entry

async function runProfileAcquirerJobCliMain(): Promise<void> {
  const args = process.argv.slice(2);
  const usernameArg = args.find((arg) => arg.startsWith("--username="));
  const triggerArg = args.find((arg) => arg.startsWith("--trigger="));
  const forceRefresh = args.includes("--force");

  const normalizedUsernames = usernameArg
    ? [usernameArg.split("=")[1]?.trim().toLowerCase()].filter(Boolean)
    : undefined;

  const triggerValue = triggerArg?.split("=")[1]?.trim().toLowerCase();
  let trigger: ProfileAcquirerJobTrigger = "manual";
  if (normalizedUsernames?.length) {
    trigger = triggerValue === "login" ? "login" : "signup";
  }

  const result = await runProfileAcquirerJob({
    trigger,
    normalizedUsernames,
    forceRefresh,
  });

  if (!result.success) {
    gathererLogFatal("Profile acquirer failed", result.errors.join("; "));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runProfileAcquirerJobCliMain();
}

// Suggestions For Features and Additions Later:
// - Dedicated profile acquirer daily cron schedule via GATHERER_PROFILE_ACQUIRER_SCHEDULE
