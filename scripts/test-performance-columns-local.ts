/**
 * Filename: test-performance-columns-local.ts
 * Purpose: Local smoke test for Creator Data column detection, parse, and merge without Backstage browser.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-07-07
 * Dependencies: xlsx, parseWorkbook, mergeBackstageReports
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { parseBackstageWorkbook } from "../src/processing/parseWorkbook";
import { mergeBackstageReports } from "../src/processing/mergeBackstageReports";

const TEST_PERFORMANCE_COLUMNS_LOCAL_DIR = path.resolve(
  process.cwd(),
  "data/raw/local-test"
);

// MARK: - Fixture Builders

interface TestPerformanceColumnsLocalFixture {
  label: string;
  performanceHeaders: string[];
  performanceRow: (string | number)[];
}

const TEST_PERFORMANCE_COLUMNS_LOCAL_FIXTURES: TestPerformanceColumnsLocalFixture[] = [
  {
    label: "classic-backstage-headers",
    performanceHeaders: [
      "Creator",
      "Creator ID",
      "Data period",
      "Total Diamonds",
      "LIVE duration",
      "Valid go LIVE days",
      "Graduation status",
      "Tier status",
    ],
    performanceRow: [
      "@testcreator",
      "7359135855103475718",
      "2026-07-01 ~ 2026-07-07",
      "1,234,567",
      "119h 47m 31s",
      "21d",
      "Active",
      "Tier maintained",
    ],
  },
  {
    label: "july-variant-selected-period-headers",
    performanceHeaders: [
      "Creator",
      "Creator ID",
      "Selected period",
      "Diamonds in selected period",
      "LIVE duration in selected period",
      "Valid go LIVE days in selected period",
      "Graduation status",
    ],
    performanceRow: [
      "@testcreator",
      "7359135855103475718",
      "2026-07-01 ~ 2026-07-07",
      "987654",
      "88.46h",
      "18d",
      "Active",
    ],
  },
  {
    label: "compact-diamonds-header",
    performanceHeaders: [
      "Creator",
      "Creator ID",
      "Diamonds",
      "LIVE duration",
      "Valid LIVE days",
    ],
    performanceRow: ["@testcreator", "7359135855103475718", "40500", "63.88h", "20d"],
  },
  {
    label: "hybrid-creator-data-l30d-labeled-period",
    performanceHeaders: [
      "Creator ID:",
      "Creator's username",
      "Group",
      "Creator Network manager",
      "Graduation status",
      "Tier status",
      "Tier last month",
      "Relationship status",
      "Subscription status",
      "Join time",
      "Days since joining",
      "Invitation type",
      "Invited by",
      "Promote permission",
      "Last LIVE",
      "Notes",
      "Followers",
      "Videos",
      "Likes",
      "Diamonds in L30D",
      "Valid go LIVE days in L30D",
      "LIVE duration in L30D",
      "Diamonds from Fan Club in L30D",
      "Active fans from Fan Club in L30D",
      "Management relationship dates",
      "Renewed management relationship dates",
    ],
    performanceRow: [
      "7359135855103475718",
      "@testcreator",
      "Group A",
      "Manager One",
      "Active",
      "Tier maintained",
      "Tier maintained",
      "Effective",
      "Active",
      "2024-01-01",
      "500",
      "Invite",
      "Agency",
      "Yes",
      "2026-07-06",
      "",
      "430336",
      "100",
      "50000",
      "123456",
      "7d",
      "12.5h",
      "1000",
      "50",
      "2024-01-01 ~ 2025-01-01",
      "",
    ],
  },
];

const TEST_PERFORMANCE_COLUMNS_LOCAL_MANAGEMENT_HEADERS = [
  "Creator",
  "Creator ID",
  "Diamonds in L30D",
  "LIVE duration in L30D",
  "Valid go LIVE days in L30D",
  "Followers",
  "Relationship status",
];

const TEST_PERFORMANCE_COLUMNS_LOCAL_MANAGEMENT_ROW: (string | number)[] = [
  "@testcreator",
  "7359135855103475718",
  "4799602",
  "156.36h",
  "30d",
  "430336",
  "Effective",
];

// MARK: - Workbook Writer

function testPerformanceColumnsLocalWriteWorkbook(
  filePath: string,
  headers: string[],
  row: (string | number)[]
): void {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, row]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  XLSX.writeFile(workbook, filePath);
}

// MARK: - Assertion Helpers

function testPerformanceColumnsLocalAssert(
  condition: boolean,
  message: string,
  failures: string[]
): void {
  if (!condition) {
    failures.push(message);
  }
}

// MARK: - Run Fixture

function testPerformanceColumnsLocalRunFixture(
  fixture: TestPerformanceColumnsLocalFixture
): { passed: boolean; failures: string[]; sample: Record<string, unknown> | null } {
  const failures: string[] = [];
  const perfPath = path.join(
    TEST_PERFORMANCE_COLUMNS_LOCAL_DIR,
    `performance-${fixture.label}.xlsx`
  );
  const mgmtPath = path.join(
    TEST_PERFORMANCE_COLUMNS_LOCAL_DIR,
    `management-${fixture.label}.xlsx`
  );

  testPerformanceColumnsLocalWriteWorkbook(perfPath, fixture.performanceHeaders, fixture.performanceRow);
  testPerformanceColumnsLocalWriteWorkbook(
    mgmtPath,
    TEST_PERFORMANCE_COLUMNS_LOCAL_MANAGEMENT_HEADERS,
    TEST_PERFORMANCE_COLUMNS_LOCAL_MANAGEMENT_ROW
  );

  const perfParsed = parseBackstageWorkbook(perfPath, "performance");
  const mgmtParsed = parseBackstageWorkbook(mgmtPath, "management");
  const validationMissing = perfParsed.missingColumns.filter((column) =>
    ["total_diamonds", "live_duration", "valid_go_live_days"].includes(column)
  );

  testPerformanceColumnsLocalAssert(
    validationMissing.length === 0,
    `missing critical performance columns after remap: ${validationMissing.join(", ")}`,
    failures
  );

  const merged = mergeBackstageReports(
    perfParsed.rows,
    mgmtParsed.rows,
    `local-test-${fixture.label}`,
    new Date().toISOString(),
    perfPath,
    mgmtPath
  );

  const creator = merged.combined[0] ?? null;

  testPerformanceColumnsLocalAssert(Boolean(creator), "no merged creator row", failures);
  testPerformanceColumnsLocalAssert(
    creator?.total_diamonds !== null && creator.total_diamonds > 0,
    `total_diamonds missing (got ${creator?.total_diamonds ?? "null"})`,
    failures
  );
  testPerformanceColumnsLocalAssert(
    creator?.live_duration_total_hours !== null && creator.live_duration_total_hours > 0,
    `live_duration_total_hours missing (got ${creator?.live_duration_total_hours ?? "null"})`,
    failures
  );
  testPerformanceColumnsLocalAssert(
    creator?.valid_live_days_total !== null && creator.valid_live_days_total > 0,
    `valid_live_days_total missing (got ${creator?.valid_live_days_total ?? "null"})`,
    failures
  );
  testPerformanceColumnsLocalAssert(
    creator?.diamonds_l30d !== null && creator.diamonds_l30d > 0,
    `diamonds_l30d missing (got ${creator?.diamonds_l30d ?? "null"})`,
    failures
  );

  return {
    passed: failures.length === 0,
    failures,
    sample: creator
      ? {
          total_diamonds: creator.total_diamonds,
          live_duration_total_hours: creator.live_duration_total_hours,
          valid_live_days_total: creator.valid_live_days_total,
          diamonds_l30d: creator.diamonds_l30d,
          performance_data_period: creator.performance_data_period,
          columnMap: perfParsed.performanceColumnMap ?? null,
        }
      : null,
  };
}

// MARK: - Real File Diagnosis

function testPerformanceColumnsLocalDiagnoseRealFile(performanceFilePath: string): void {
  const resolvedPath = path.resolve(performanceFilePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Diagnosing real performance export: ${resolvedPath}\n`);
  const perfParsed = parseBackstageWorkbook(resolvedPath, "performance");
  const sampleRow = perfParsed.rows[0] ?? null;

  console.log(JSON.stringify({
    rawHeaders: perfParsed.rawHeaders,
    missingColumns: perfParsed.missingColumns,
    columnMap: perfParsed.performanceColumnMap ?? null,
    rowCount: perfParsed.rows.length,
    sampleMappedFields: sampleRow
      ? {
          total_diamonds: sampleRow.total_diamonds ?? null,
          live_duration: sampleRow.live_duration ?? null,
          valid_go_live_days: sampleRow.valid_go_live_days ?? null,
          data_period: sampleRow.data_period ?? null,
        }
      : null,
  }, null, 2));
}

// MARK: - Main

function testPerformanceColumnsLocalMain(): void {
  const realFileArg = process.argv[2];
  if (realFileArg) {
    testPerformanceColumnsLocalDiagnoseRealFile(realFileArg);
    return;
  }

  fs.mkdirSync(TEST_PERFORMANCE_COLUMNS_LOCAL_DIR, { recursive: true });

  console.log("InfiniView Backstage Gatherer — local performance column test\n");

  let passedCount = 0;
  const results: Array<{ label: string; passed: boolean; failures: string[]; sample: unknown }> = [];

  for (const fixture of TEST_PERFORMANCE_COLUMNS_LOCAL_FIXTURES) {
    const result = testPerformanceColumnsLocalRunFixture(fixture);
    results.push({ label: fixture.label, ...result });
    if (result.passed) {
      passedCount += 1;
      console.log(`PASS  ${fixture.label}`);
      console.log(JSON.stringify(result.sample, null, 2));
    } else {
      console.log(`FAIL  ${fixture.label}`);
      for (const failure of result.failures) {
        console.log(`  - ${failure}`);
      }
    }
    console.log("");
  }

  console.log(`Result: ${passedCount}/${TEST_PERFORMANCE_COLUMNS_LOCAL_FIXTURES.length} fixtures passed`);

  if (passedCount !== TEST_PERFORMANCE_COLUMNS_LOCAL_FIXTURES.length) {
    process.exitCode = 1;
  }
}

testPerformanceColumnsLocalMain();

// Suggestions For Features and Additions Later:
// - Accept a real performance xlsx path via CLI arg for one-off header diagnosis
// - Wire into npm test once a formal test runner is added
