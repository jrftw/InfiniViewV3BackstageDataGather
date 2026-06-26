/**
 * Filename: config.ts
 * Purpose: Central configuration loaded from environment variables for the Backstage Gatherer.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-25
 * Dependencies: dotenv
 * Platform Compatibility: Node.js 18+ (Windows server PC)
 */

import dotenv from "dotenv";
import path from "path";
import {
  GathererScheduleMode,
  gathererLoadFixedRunScheduleLabels,
} from "./scheduler/gathererSchedulePlanner";

// MARK: - Environment Bootstrap

const GATHERER_ENV_FILE_PATH = path.resolve(process.cwd(), ".env");

/** Loads .env from project root (call before reading process.env). */
export function loadGathererEnvFile(): void {
  dotenv.config({ path: GATHERER_ENV_FILE_PATH });
}

loadGathererEnvFile();

// MARK: - Process Timezone (scheduler + exports align with US Eastern)

if (!process.env.TZ) {
  process.env.TZ = "America/New_York";
}

// MARK: - Configuration Types

export interface GathererConfig {
  nodeEnv: string;
  timezone: string;
  appPort: number;
  backstageBaseUrl: string;
  backstageAuthStatePath: string;
  googleServiceAccountEmail: string;
  googleServiceAccountPrivateKey: string;
  /** Workspace user to impersonate via domain-wide delegation (My Drive upload quota). */
  googleDelegatedUser: string;
  /** Comma-separated OAuth scopes for delegated auth (optional — sensible defaults apply). */
  googleScopes: string[];
  googleDriveFolderId: string;
  googleDriveDailyArchiveFolderId: string;
  googleMasterSheetId: string;
  googleCrmSheetId: string;
  googleCrmSheetTab: string;
  googleDipSheetId: string;
  googleDipSheetTab: string;
  googleDipSheetGid: string;
  localDownloadDir: string;
  localRawDir: string;
  localProcessedDir: string;
  localLogDir: string;
  localCacheDir: string;
  runSchedules: string[];
  gathererScheduleMode: GathererScheduleMode;
  gathererRunsPerDay: number;
  gathererActiveHoursStart: string;
  gathererActiveHoursEnd: string;
  gathererRunJitterMinutes: number;
  gathererMinMinutesBetweenRuns: number;
  gathererDailyArchiveTime: string;
  gathererKeepRawPairsPerDay: number;
  gathererBackstageForceReloginHours: number;
  keepLocalFilesDays: number;
  gitUpdateBranch: string;
  gitUpdateCheckMinutes: number;
  backstagePerformanceDays: number;
  backstagePerformanceDateRange: "month" | "rolling";
  backstageHeadless: boolean;
  backstageSlowMoMs: number;
  backstageLocale: string;
  backstageTimezone: string;
  backstageRegionCode: string;
  backstageAcceptLanguage: string;
  backstageGeoLatitude: number;
  backstageGeoLongitude: number;
  backstageEmail: string;
  backstagePassword: string;
  backstageAgencyRegion: string;
  backstageForceUsPlus: boolean;
  gathererRequireManagementMatch: boolean;
  gathererRequireEffectiveRelationship: boolean;
  gathererExcludeGraduationStatuses: string[];
  gathererUpdateMasterDailyTab: boolean;
  gathererMasterSheetIncrementalUpdates: boolean;
  profileAcquirerEnabled: boolean;
  profileAcquirerRunAfterBackstage: boolean;
  profileAcquirerAfterBackstageNewOnly: boolean;
  profileAcquirerStaleHours: number;
  profileAcquirerBatchLimit: number;
  googleDriveProfileImagesFolderId: string;
  googleDriveProfileImagesSubfolder: string;
  profileAcquirerBrowserVideosEnabled: boolean;
  profileAcquirerTiktokHeadless: boolean;
  projectRoot: string;
}

// MARK: - Path Helpers

function gathererResolvePath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

function gathererParsePrivateKey(rawKey: string): string {
  if (!rawKey) {
    return "";
  }
  return rawKey.replace(/\\n/g, "\n");
}

function gathererParseBackstageHeadless(): boolean {
  if (process.env.HEADLESS === "false") {
    return false;
  }
  if (process.env.HEADLESS === "true") {
    return true;
  }
  if (
    process.env.BACKSTAGE_HEADLESS === "false" ||
    process.env.BACKSTAGE_HEADLESS === "0" ||
    process.env.GATHERER_BACKSTAGE_HEADED === "true"
  ) {
    return false;
  }
  return true;
}

function gathererParseCommaList(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// MARK: - Configuration Loader

export function loadGathererConfig(): GathererConfig {
  loadGathererEnvFile();

  const gathererScheduleMode: GathererScheduleMode =
    process.env.GATHERER_SCHEDULE_MODE === "random" ? "random" : "fixed";
  const runSchedules = gathererLoadFixedRunScheduleLabels();

  return {
    nodeEnv: process.env.NODE_ENV ?? "production",
    timezone: process.env.TZ ?? "America/New_York",
    appPort: Number(process.env.APP_PORT ?? 3099),
    backstageBaseUrl: process.env.BACKSTAGE_BASE_URL ?? "https://live-backstage.tiktok.com",
    backstageAuthStatePath: gathererResolvePath(
      process.env.BACKSTAGE_AUTH_STATE_PATH ?? "data/auth/backstage-auth.json"
    ),
    googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "",
    googleServiceAccountPrivateKey: gathererParsePrivateKey(
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? ""
    ),
    googleDelegatedUser:
      process.env.GOOGLE_DELEGATED_USER ?? process.env.GOOGLE_WORKSPACE_DELEGATED_USER ?? "",
    googleScopes: gathererParseCommaList(process.env.GOOGLE_SCOPES ?? ""),
    googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID ?? "",
    googleDriveDailyArchiveFolderId: process.env.GOOGLE_DRIVE_DAILY_ARCHIVE_FOLDER_ID ?? "",
    googleMasterSheetId: process.env.GOOGLE_MASTER_SHEET_ID ?? "",
    googleCrmSheetId: process.env.GOOGLE_CRM_SHEET_ID ?? "",
    googleCrmSheetTab: process.env.GOOGLE_CRM_SHEET_TAB ?? "",
    googleDipSheetId: process.env.GOOGLE_DIP_SHEET_ID ?? "",
    googleDipSheetTab: process.env.GOOGLE_DIP_SHEET_TAB ?? "",
    googleDipSheetGid: process.env.GOOGLE_DIP_SHEET_GID ?? "",
    localDownloadDir: gathererResolvePath(process.env.LOCAL_DOWNLOAD_DIR ?? "data/downloads"),
    localRawDir: gathererResolvePath(process.env.LOCAL_RAW_DIR ?? "data/raw"),
    localProcessedDir: gathererResolvePath(process.env.LOCAL_PROCESSED_DIR ?? "data/processed"),
    localLogDir: gathererResolvePath(process.env.LOCAL_LOG_DIR ?? "data/logs"),
    localCacheDir: gathererResolvePath(process.env.LOCAL_CACHE_DIR ?? "cache/creators"),
    runSchedules,
    gathererScheduleMode,
    gathererRunsPerDay: Number(process.env.GATHERER_RUNS_PER_DAY ?? 10),
    gathererActiveHoursStart: process.env.GATHERER_ACTIVE_HOURS_START ?? "07:30",
    gathererActiveHoursEnd: process.env.GATHERER_ACTIVE_HOURS_END ?? "22:30",
    gathererRunJitterMinutes: Number(process.env.GATHERER_RUN_JITTER_MINUTES ?? 18),
    gathererMinMinutesBetweenRuns: Number(process.env.GATHERER_MIN_MINUTES_BETWEEN_RUNS ?? 55),
    gathererDailyArchiveTime: process.env.GATHERER_DAILY_ARCHIVE_TIME ?? "20:00",
    gathererKeepRawPairsPerDay: Number(process.env.GATHERER_KEEP_RAW_PAIRS_PER_DAY ?? 4),
    gathererBackstageForceReloginHours: Number(
      process.env.GATHERER_BACKSTAGE_FORCE_RELOGIN_HOURS ?? 8
    ),
    keepLocalFilesDays: Number(process.env.KEEP_LOCAL_FILES_DAYS ?? 14),
    gitUpdateBranch: process.env.GIT_UPDATE_BRANCH ?? "main",
    gitUpdateCheckMinutes: Number(process.env.GIT_UPDATE_CHECK_MINUTES ?? 15),
    backstagePerformanceDays: Number(process.env.BACKSTAGE_PERFORMANCE_DAYS ?? 30),
    backstagePerformanceDateRange:
      process.env.BACKSTAGE_PERFORMANCE_DATE_RANGE === "rolling" ? "rolling" : "month",
    backstageHeadless: gathererParseBackstageHeadless(),
    backstageSlowMoMs: Number(process.env.BACKSTAGE_SLOW_MO_MS ?? 0),
    backstageLocale: process.env.BACKSTAGE_LOCALE ?? "en-US",
    backstageTimezone: process.env.BACKSTAGE_TIMEZONE ?? process.env.TZ ?? "America/New_York",
    backstageRegionCode: process.env.BACKSTAGE_REGION ?? "US",
    backstageAcceptLanguage: process.env.BACKSTAGE_ACCEPT_LANGUAGE ?? "en-US,en;q=0.9",
    backstageGeoLatitude: Number(process.env.BACKSTAGE_GEO_LAT ?? 40.7128),
    backstageGeoLongitude: Number(process.env.BACKSTAGE_GEO_LNG ?? -74.006),
    backstageEmail: process.env.BACKSTAGE_EMAIL ?? process.env.TIKTOK_EMAIL ?? "",
    backstagePassword: process.env.BACKSTAGE_PASSWORD ?? process.env.TIKTOK_PASSWORD ?? "",
    backstageAgencyRegion: process.env.BACKSTAGE_AGENCY_REGION ?? "US+",
    backstageForceUsPlus: process.env.BACKSTAGE_FORCE_US_PLUS !== "false",
    gathererRequireManagementMatch: process.env.GATHERER_REQUIRE_MANAGEMENT_MATCH !== "false",
    gathererRequireEffectiveRelationship:
      process.env.GATHERER_REQUIRE_EFFECTIVE_RELATIONSHIP !== "false",
    gathererExcludeGraduationStatuses: (
      process.env.GATHERER_EXCLUDE_GRADUATION_STATUSES ?? "quit,removed,expired"
    )
      .split(",")
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean),
    gathererUpdateMasterDailyTab: process.env.GATHERER_UPDATE_MASTER_DAILY_TAB === "true",
    gathererMasterSheetIncrementalUpdates:
      process.env.GATHERER_MASTER_SHEET_INCREMENTAL_UPDATES !== "false",
    profileAcquirerEnabled: process.env.GATHERER_PROFILE_ACQUIRER_ENABLED !== "false",
    profileAcquirerRunAfterBackstage:
      process.env.GATHERER_PROFILE_ACQUIRER_AFTER_BACKSTAGE === "true",
    profileAcquirerAfterBackstageNewOnly:
      process.env.GATHERER_PROFILE_ACQUIRER_AFTER_BACKSTAGE_NEW_ONLY !== "false",
    profileAcquirerStaleHours: Number(process.env.GATHERER_PROFILE_ACQUIRER_STALE_HOURS ?? 24),
    profileAcquirerBatchLimit: Number(process.env.GATHERER_PROFILE_ACQUIRER_BATCH_LIMIT ?? 25),
    googleDriveProfileImagesFolderId: process.env.GOOGLE_DRIVE_PROFILE_IMAGES_FOLDER_ID ?? "",
    googleDriveProfileImagesSubfolder:
      process.env.GOOGLE_DRIVE_PROFILE_IMAGES_SUBFOLDER ?? "Profile Pictures",
    profileAcquirerBrowserVideosEnabled:
      process.env.GATHERER_PROFILE_ACQUIRER_BROWSER_VIDEOS !== "false",
    profileAcquirerTiktokHeadless:
      process.env.GATHERER_PROFILE_ACQUIRER_TIKTOK_HEADLESS !== "false",
    projectRoot: process.cwd(),
  };
}

// Suggestions For Features and Additions Later:
// - Add config validation schema (zod) for startup errors
// - Support config.json override for non-secret settings
