/**
 * Filename: buildOutputs.ts
 * Purpose: Write combined XLSX, CSV, JSON and import summary files locally.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Dependencies: xlsx
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { CombinedCreatorRecord } from "./mergeBackstageReports";
import { gathererEnsureDir, gathererWriteJsonFile } from "../utils/files";
import { ImportSummaryData } from "../logging/importSummary";

// MARK: - Output Paths

export interface BuiltOutputPaths {
  combinedXlsx: string;
  combinedCsv: string;
  combinedJson: string;
  importSummaryJson: string;
}

// MARK: - Build Outputs

function buildOutputsApplyFrozenHeaderRow(worksheet: XLSX.WorkSheet): void {
  worksheet["!views"] = [
    {
      state: "frozen",
      ySplit: 1,
      topLeftCell: "A2",
      activeCell: "A2",
    },
  ];
}

export function buildCombinedOutputFiles(
  processedDir: string,
  dailyOutputBaseName: string,
  creators: CombinedCreatorRecord[],
  summary: ImportSummaryData
): BuiltOutputPaths {
  gathererEnsureDir(processedDir);

  const combinedXlsx = path.join(processedDir, `${dailyOutputBaseName}.xlsx`);
  const combinedCsv = path.join(processedDir, `${dailyOutputBaseName}.csv`);
  const combinedJson = path.join(processedDir, `${dailyOutputBaseName}.json`);
  const importSummaryJson = path.join(
    processedDir,
    `import-summary-${dailyOutputBaseName.replace("combined-creators-", "")}.json`
  );

  const worksheet = XLSX.utils.json_to_sheet(creators);
  buildOutputsApplyFrozenHeaderRow(worksheet);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Combined Creators");
  XLSX.writeFile(workbook, combinedXlsx);

  const csv = XLSX.utils.sheet_to_csv(worksheet);
  fs.writeFileSync(combinedCsv, csv, "utf-8");

  gathererWriteJsonFile(combinedJson, creators);
  gathererWriteJsonFile(importSummaryJson, summary);

  return { combinedXlsx, combinedCsv, combinedJson, importSummaryJson };
}

// Suggestions For Features and Additions Later:
// - Stream large JSON for 10k+ creators
