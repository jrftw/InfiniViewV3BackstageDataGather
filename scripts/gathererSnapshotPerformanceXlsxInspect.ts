/**
 * Filename: gathererSnapshotPerformanceXlsxInspect.ts
 * Purpose: Parse backstage-performance xlsx from a daily archive folder.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Platform Compatibility: Node.js 18+
 */

import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import { loadGathererConfig } from "../src/config";
import { gathererSnapshotHistoryListArchiveEntries } from "../src/snapshotHistory/gathererSnapshotHistoryDriveScanner";
import { createGoogleDriveClient } from "../src/google/driveClient";
import { parseBackstageWorkbook } from "../src/processing/parseWorkbook";
import { mergeBackstageReports } from "../src/processing/mergeBackstageReports";

async function gathererSnapshotPerformanceXlsxInspectMain(): Promise<void> {
  const config = loadGathererConfig();
  const snapshotDate = process.argv[2] ?? "2026-07-01";
  const creatorId = process.argv[3] ?? "7359134441639346182";
  const entries = await gathererSnapshotHistoryListArchiveEntries(config);
  const archive = entries.find((entry) => entry.snapshotDate === snapshotDate);
  if (!archive) {
    console.log("archive not found");
    return;
  }

  const drive = createGoogleDriveClient(config);
  const list = await drive.files.list({
    q: `'${archive.dateFolderId}' in parents and name contains 'backstage-performance-${snapshotDate}' and trashed=false`,
    fields: "files(id, name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const performanceFile = list.data.files?.[0];
  const managementList = await drive.files.list({
    q: `'${archive.dateFolderId}' in parents and name contains 'backstage-management-${snapshotDate}' and trashed=false`,
    fields: "files(id, name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const managementFile = managementList.data.files?.[0];

  if (!performanceFile?.id) {
    console.log("performance xlsx not found");
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gatherer-snapshot-inspect-"));
  const performancePath = path.join(tempDir, performanceFile.name ?? "performance.xlsx");
  const managementPath = managementFile?.id
    ? path.join(tempDir, managementFile.name ?? "management.xlsx")
    : null;

  const performanceDownload = await drive.files.get(
    { fileId: performanceFile.id, alt: "media" },
    { responseType: "arraybuffer" }
  );
  fs.writeFileSync(performancePath, Buffer.from(performanceDownload.data as ArrayBuffer));

  if (managementFile?.id && managementPath) {
    const managementDownload = await drive.files.get(
      { fileId: managementFile.id, alt: "media" },
      { responseType: "arraybuffer" }
    );
    fs.writeFileSync(managementPath, Buffer.from(managementDownload.data as ArrayBuffer));
  }

  const performanceParsed = parseBackstageWorkbook(performancePath, "performance");
  const managementParsed = managementPath
    ? parseBackstageWorkbook(managementPath, "management")
    : { rows: [] as import("../src/processing/parseWorkbook").ParsedBackstageRow[] };
  const merged = mergeBackstageReports(
    performanceParsed.rows,
    managementParsed.rows,
    "inspect",
    new Date().toISOString(),
    performanceFile.name ?? "performance.xlsx",
    managementFile?.name ?? "management.xlsx",
    {
      timezone: config.timezone,
      referenceDate: new Date(`${snapshotDate}T12:00:00Z`),
    }
  );

  const match = merged.combined.find((creator) => String(creator.backstage_creator_id ?? "") === creatorId);

  console.log(
    JSON.stringify(
      {
        snapshotDate,
        performanceFile: performanceFile.name,
        managementFile: managementFile?.name ?? null,
        performanceRows: performanceParsed.rows.length,
        managementRows: managementParsed.rows.length,
        mergedCreators: merged.combined.length,
        mergedWithDiamonds: merged.combined.filter((creator) => typeof creator.total_diamonds === "number")
          .length,
        matchedCreator: match
          ? {
              tiktok_username: match.tiktok_username,
              total_diamonds: match.total_diamonds,
              live_duration_total_hours: match.live_duration_total_hours,
              valid_live_days_total: match.valid_live_days_total,
              performance_data_period: match.performance_data_period,
            }
          : null,
      },
      null,
      2
    )
  );
}

gathererSnapshotPerformanceXlsxInspectMain().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
