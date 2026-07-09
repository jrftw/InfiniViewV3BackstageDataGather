/**
 * Filename: gathererSnapshotArchiveFolderInspect.ts
 * Purpose: List files inside a daily Drive archive folder to find performance exports.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Platform Compatibility: Node.js 18+
 */

import "dotenv/config";
import { loadGathererConfig } from "../src/config";
import { gathererSnapshotHistoryListArchiveEntries } from "../src/snapshotHistory/gathererSnapshotHistoryDriveScanner";
import { createGoogleDriveClient } from "../src/google/driveClient";

async function gathererSnapshotArchiveFolderInspectMain(): Promise<void> {
  const config = loadGathererConfig();
  const snapshotDate = process.argv[2] ?? "2026-07-01";
  const entries = await gathererSnapshotHistoryListArchiveEntries(config);
  const archive = entries.find((entry) => entry.snapshotDate === snapshotDate);
  if (!archive) {
    console.log("archive not found", snapshotDate);
    return;
  }

  const drive = createGoogleDriveClient(config);
  const response = await drive.files.list({
    q: `'${archive.dateFolderId}' in parents and trashed=false`,
    fields: "files(id, name, mimeType)",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  console.log(
    JSON.stringify(
      {
        snapshotDate,
        dateFolderId: archive.dateFolderId,
        files: response.data.files ?? [],
      },
      null,
      2
    )
  );
}

gathererSnapshotArchiveFolderInspectMain().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
