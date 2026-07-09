/**
 * Filename: gathererSnapshotArchiveHeaderInspect.ts
 * Purpose: Compare Combined Creators headers/metrics between early and late July archives.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-09
 * Platform Compatibility: Node.js 18+
 */

import "dotenv/config";
import { loadGathererConfig } from "../src/config";
import { gathererSnapshotHistoryListArchiveEntries } from "../src/snapshotHistory/gathererSnapshotHistoryDriveScanner";
import { createGoogleSheetsClient } from "../src/google/sheetsClient";
import { readMasterCreatorsSheetParseCombinedCreatorsValues } from "../src/google/readMasterCreatorsSheet";

const GATHERER_SNAPSHOT_ARCHIVE_HEADER_INSPECT_USERNAME = "team_wolf_pack";

async function gathererSnapshotArchiveHeaderInspectMain(): Promise<void> {
  const config = loadGathererConfig();
  const dates = (process.argv[2] ?? "2026-07-01,2026-07-07").split(",").map((entry) => entry.trim());
  const entries = await gathererSnapshotHistoryListArchiveEntries(config);
  const sheets = createGoogleSheetsClient(config);
  const tabName = config.gathererSnapshotHistoryCombinedTab;

  for (const snapshotDate of dates) {
    const archive = entries.find((entry) => entry.snapshotDate === snapshotDate);
    if (!archive) {
      console.log(snapshotDate, "archive not found");
      continue;
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: archive.spreadsheetId,
      range: `'${tabName.replace(/'/g, "''")}'!A:ZZ`,
    });

    const rows = (response.data.values ?? []) as string[][];
    const headers = rows[0] ?? [];
    const normalizedHeaders = headers.map((header) =>
      String(header).trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
    );
    const totalDiamondsIndex = normalizedHeaders.indexOf("total_diamonds");
    const creators = readMasterCreatorsSheetParseCombinedCreatorsValues(rows);
    const match = creators.find((creator) => {
      const username = String(creator.normalized_username ?? creator.tiktok_username ?? "").toLowerCase();
      return username.includes(GATHERER_SNAPSHOT_ARCHIVE_HEADER_INSPECT_USERNAME) ||
        String(creator.backstage_creator_id ?? "") === "7359134441639346182";
    });

    console.log(
      JSON.stringify(
        {
          snapshotDate,
          spreadsheetId: archive.spreadsheetId,
          headerCount: headers.length,
          totalDiamondsIndex,
          totalDiamondsHeader: totalDiamondsIndex >= 0 ? headers[totalDiamondsIndex] : null,
          headers: headers.slice(0, 40),
          matchedCreator: match
            ? {
                tiktok_username: match.tiktok_username,
                total_diamonds: match.total_diamonds,
                live_duration_total_hours: match.live_duration_total_hours,
                valid_live_days_total: match.valid_live_days_total,
              }
            : null,
          creatorsParsed: creators.length,
          creatorsWithDiamonds: creators.filter((creator) => typeof creator.total_diamonds === "number")
            .length,
        },
        null,
        2
      )
    );
  }
}

gathererSnapshotArchiveHeaderInspectMain().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Suggestions For Features and Additions Later:
// - Dump unrecognized headers for alias expansion
