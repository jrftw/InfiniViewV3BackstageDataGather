/**
 * Filename: runPreflightCheck.ts
 * Purpose: CLI entry — run preflight checks only (no Backstage export).
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+ (Windows server PC)
 */

import { loadGathererConfig } from "../config";
import { runGathererPreflightCheck } from "./preflightCheck";
import { gathererLogFatal } from "../logging/friendlyLog";

// MARK: - CLI

async function runPreflightCheckCliMain(): Promise<void> {
  const config = loadGathererConfig();
  const result = await runGathererPreflightCheck(config);

  if (!result.ok) {
    gathererLogFatal("Preflight check failed", result.blockingErrors.join("; "));
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

runPreflightCheckCliMain();

// Suggestions For Features and Additions Later:
// - JSON output flag for automation
