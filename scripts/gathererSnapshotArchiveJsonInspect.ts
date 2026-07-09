/**
 * Filename: gathererSnapshotArchiveJsonInspect.ts
 * Purpose: Inspect combined-creators JSON in a daily archive for performance metrics.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Platform Compatibility: Node.js 18+
 */

import "dotenv/config";
import { loadGathererConfig } from "../src/config";
import { gathererSnapshotHistoryListArchiveEntries } from "../src/snapshotHistory/gathererSnapshotHistoryDriveScanner";
import { createGoogleDriveClient } from "../src/google/driveClient";

async function gathererSnapshotArchiveJsonInspectMain(): Promise<void> {
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
    q: `'${archive.dateFolderId}' in parents and name='combined-creators-${snapshotDate}.json' and trashed=false`,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const file = list.data.files?.[0];
  if (!file?.id) {
    console.log("json not found");
    return;
  }

  const downloaded = await drive.files.get(
    { fileId: file.id, alt: "media" },
    { responseType: "text" }
  );

  const payload = JSON.parse(String(downloaded.data)) as Record<string, unknown>;
  const creators = Array.isArray(payload.creators)
    ? payload.creators
    : Array.isArray(payload)
      ? payload
      : [];
  const match = creators.find((creator) => String(creator.backstage_creator_id ?? "") === creatorId);

  console.log(
    JSON.stringify(
      {
        snapshotDate,
        topLevelKeys: Object.keys(payload).slice(0, 20),
        creatorsInJson: creators.length,
        creatorsWithDiamonds: creators.filter((creator) => typeof creator.total_diamonds === "number").length,
        matchedCreator: match
          ? {
              tiktok_username: match.tiktok_username,
              total_diamonds: match.total_diamonds,
              live_duration_total_hours: match.live_duration_total_hours,
              valid_live_days_total: match.valid_live_days_total,
            }
          : null,
      },
      null,
      2
    )
  );
}

gathererSnapshotArchiveJsonInspectMain().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
