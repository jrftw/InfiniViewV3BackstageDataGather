/**
 * Filename: backstageSessionRelogin.ts
 * Purpose: Invalidate stale Backstage auth so scheduled runs perform a fresh login.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-25
 * Dependencies: fs, GathererConfig, logger
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import { GathererConfig } from "../config";
import { logInfo } from "../logging/logger";

// MARK: - Stale Session Invalidation

export function gathererInvalidateStaleBackstageAuthIfNeeded(config: GathererConfig): void {
  const reloginHours = config.gathererBackstageForceReloginHours;
  if (reloginHours <= 0) {
    return;
  }

  if (!fs.existsSync(config.backstageAuthStatePath)) {
    return;
  }

  const ageMs = Date.now() - fs.statSync(config.backstageAuthStatePath).mtimeMs;
  const maxAgeMs = reloginHours * 60 * 60 * 1000;

  if (ageMs >= maxAgeMs) {
    fs.unlinkSync(config.backstageAuthStatePath);
    logInfo(
      `Cleared saved Backstage session (older than ${reloginHours}h) — next run will log in again`,
      "backstageSessionRelogin"
    );
  }
}

// Suggestions For Features and Additions Later:
// - Store last_successful_login_at in auth metadata JSON
