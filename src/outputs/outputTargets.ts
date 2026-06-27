/**
 * Filename: outputTargets.ts
 * Purpose: Pluggable output interface — local, Drive, Sheets, future DB.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

import { GathererConfig, gathererIsMongoConfigured } from "../config";
import { isGoogleConfigured } from "../google/googleAuth";
import { uploadGathererRunToDrive } from "../google/uploadDriveFile";
import { updateGoogleSheetTabs } from "../google/updateSheetTabs";
import { readManualEnrichmentTab } from "../google/readManualEnrichment";
import { readExternalCrmSheetTab } from "../google/readExternalCrmSheet";
import { readExternalDipSheetTab } from "../google/readExternalDipSheet";
import { GathererRunContext } from "../jobs/gathererRunContext";
import { CombinedCreatorRecord } from "../processing/mergeBackstageReports";
import { ParsedBackstageRow } from "../processing/parseWorkbook";
import { ImportSummaryData } from "../logging/importSummary";
import { SyncLogAppendRow } from "../google/syncSheetTabs";
import { logInfo, logError } from "../logging/logger";
import { publishCreatorsToMongo } from "../mongo/publishCreatorsToMongo";

// MARK: - Output Context

export interface GathererOutputContext {
  config: GathererConfig;
  runContext: GathererRunContext;
  creators: CombinedCreatorRecord[];
  performanceRows: ParsedBackstageRow[];
  managementRows: ParsedBackstageRow[];
  unmatchedPerformance: ParsedBackstageRow[];
  unmatchedManagement: ParsedBackstageRow[];
  summary: ImportSummaryData;
  allLocalFiles: string[];
  syncLog?: SyncLogAppendRow;
}

export interface GathererPublishResult {
  driveUploaded: boolean;
  sheetsUpdated: boolean;
  mongoPublished: boolean;
  mongoCreatorsUpserted: number;
  mongoSnapshotsInserted: number;
  dailyArchiveUrl: string | null;
}

// MARK: - Output Target Interface

export interface OutputTarget {
  name: string;
  publish(context: GathererOutputContext): Promise<boolean>;
}

// MARK: - Local File Output (already written — no-op publish)

export const localFileOutputTarget: OutputTarget = {
  name: "LocalFileOutput",
  async publish(): Promise<boolean> {
    logInfo("Local files already saved", "LocalFileOutput");
    return true;
  },
};

// MARK: - Google Drive Output

let gathererLastDailyArchiveUrl: string | null = null;

export const googleDriveOutputTarget: OutputTarget = {
  name: "GoogleDriveOutput",
  async publish(context: GathererOutputContext): Promise<boolean> {
    if (!isGoogleConfigured(context.config)) {
      logInfo("Google Drive skipped — not configured", "GoogleDriveOutput");
      gathererLastDailyArchiveUrl = null;
      return false;
    }
    try {
      const driveResult = await uploadGathererRunToDrive({
        config: context.config,
        files: context.allLocalFiles,
        runContext: context.runContext,
        creators: context.creators,
        performanceRows: context.performanceRows,
        managementRows: context.managementRows,
        summary: context.summary,
      });
      gathererLastDailyArchiveUrl = driveResult.dailyArchive?.spreadsheetUrl ?? null;
      return driveResult.uploaded;
    } catch (error) {
      logError("Google Drive upload failed", "GoogleDriveOutput", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  },
};

// MARK: - Google Sheets Output

export const googleSheetsOutputTarget: OutputTarget = {
  name: "GoogleSheetsOutput",
  async publish(context: GathererOutputContext): Promise<boolean> {
    if (!isGoogleConfigured(context.config)) {
      logInfo("Google Sheets skipped — not configured", "GoogleSheetsOutput");
      return false;
    }
    try {
      await updateGoogleSheetTabs(
        context.config,
        context.creators,
        context.performanceRows,
        context.managementRows,
        context.unmatchedPerformance,
        context.unmatchedManagement,
        context.summary,
        context.runContext,
        context.syncLog
      );
      return true;
    } catch (error) {
      logError("Google Sheets update failed", "GoogleSheetsOutput", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  },
};

// MARK: - MongoDB Output

let gathererLastMongoPublishStats: {
  published: boolean;
  creatorsUpserted: number;
  snapshotsInserted: number;
} = {
  published: false,
  creatorsUpserted: 0,
  snapshotsInserted: 0,
};

export const mongoDbOutputTarget: OutputTarget = {
  name: "MongoDbOutput",
  async publish(context: GathererOutputContext): Promise<boolean> {
    gathererLastMongoPublishStats = {
      published: false,
      creatorsUpserted: 0,
      snapshotsInserted: 0,
    };

    if (!gathererIsMongoConfigured(context.config)) {
      logInfo("MongoDB skipped — not configured", "MongoDbOutput");
      return false;
    }

    try {
      const mongoResult = await publishCreatorsToMongo(
        context.config,
        context.creators,
        context.summary
      );
      gathererLastMongoPublishStats = {
        published: mongoResult.published,
        creatorsUpserted: mongoResult.creatorsUpserted,
        snapshotsInserted: mongoResult.snapshotsInserted,
      };
      return mongoResult.published;
    } catch (error) {
      logError("MongoDB publish failed", "MongoDbOutput", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  },
};

// MARK: - Publish All Targets

export async function publishToAllOutputTargets(
  context: GathererOutputContext
): Promise<GathererPublishResult> {
  const targets = [
    localFileOutputTarget,
    googleDriveOutputTarget,
    googleSheetsOutputTarget,
    mongoDbOutputTarget,
  ];

  let driveUploaded = false;
  let sheetsUpdated = false;
  let mongoPublished = false;
  let mongoCreatorsUpserted = 0;
  let mongoSnapshotsInserted = 0;
  gathererLastDailyArchiveUrl = null;
  gathererLastMongoPublishStats = {
    published: false,
    creatorsUpserted: 0,
    snapshotsInserted: 0,
  };

  for (const target of targets) {
    const ok = await target.publish(context);
    if (target.name === "GoogleDriveOutput") driveUploaded = ok;
    if (target.name === "GoogleSheetsOutput") sheetsUpdated = ok;
    if (target.name === "MongoDbOutput") {
      mongoPublished = ok;
      mongoCreatorsUpserted = gathererLastMongoPublishStats.creatorsUpserted;
      mongoSnapshotsInserted = gathererLastMongoPublishStats.snapshotsInserted;
    }
  }

  return {
    driveUploaded,
    sheetsUpdated,
    mongoPublished,
    mongoCreatorsUpserted,
    mongoSnapshotsInserted,
    dailyArchiveUrl: gathererLastDailyArchiveUrl,
  };
}

export async function loadManualEnrichmentIfConfigured(
  config: GathererConfig
): Promise<import("../processing/applyManualEnrichment").ManualEnrichmentRow[]> {
  if (!isGoogleConfigured(config)) {
    return [];
  }
  try {
    return await readManualEnrichmentTab(config);
  } catch {
    return [];
  }
}

export async function loadCrmSheetEnrichmentIfConfigured(
  config: GathererConfig
): Promise<import("../processing/applyCrmSheetEnrichment").CrmSheetEnrichmentRow[]> {
  if (!isGoogleConfigured(config) || !config.googleCrmSheetId) {
    return [];
  }
  try {
    const rows = await readExternalCrmSheetTab(config);
    logInfo(`CRM sheet enrichment ready: ${rows.length} rows`, "outputTargets");
    return rows;
  } catch (error) {
    logError("External CRM sheet read failed", "outputTargets", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function loadDipSheetEnrichmentIfConfigured(
  config: GathererConfig
): Promise<import("../processing/applyDipSheetEnrichment").DipSheetEnrichmentRow[]> {
  if (!isGoogleConfigured(config) || !config.googleDipSheetId) {
    return [];
  }
  try {
    const rows = await readExternalDipSheetTab(config);
    logInfo(`DIP sheet enrichment ready: ${rows.length} rows`, "outputTargets");
    return rows;
  } catch (error) {
    logError("External DIP sheet read failed", "outputTargets", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// Suggestions For Features and Additions Later:
// - FutureDatabaseOutput adapter for additional databases (Supabase/Postgres)
// - Parallel publish to Drive/Sheets/Mongo when safe for throughput
