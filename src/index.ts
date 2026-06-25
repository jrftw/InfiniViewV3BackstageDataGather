/**
 * Filename: index.ts
 * Purpose: Application entry — starts server, scheduler, and git auto-update watcher.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+ (Windows server PC)
 */

import fs from "fs";
import path from "path";
import { loadGathererConfig } from "./config";
import { logInfo } from "./logging/logger";
import { startGathererServer } from "./server";
import { startGathererScheduler } from "./scheduler";
import { startGitAutoUpdateWatcher } from "./gitAutoUpdate";
import { gathererEnsureDir } from "./utils/files";

// MARK: - PID File

function gathererWritePidFile(projectRoot: string): void {
  const pidPath = path.join(projectRoot, ".server.pid");
  fs.writeFileSync(pidPath, String(process.pid), "utf-8");
}

// MARK: - Bootstrap

function gathererMain(): void {
  const config = loadGathererConfig();

  gathererEnsureDir(config.localDownloadDir);
  gathererEnsureDir(config.localRawDir);
  gathererEnsureDir(config.localProcessedDir);
  gathererEnsureDir(config.localLogDir);
  gathererEnsureDir(path.dirname(config.backstageAuthStatePath));

  gathererWritePidFile(config.projectRoot);

  logInfo("InfiniView V3 Backstage Gatherer starting", "index");

  startGathererServer(config);
  startGathererScheduler(config);
  startGitAutoUpdateWatcher(config);
}

gathererMain();

// Suggestions For Features and Additions Later:
// - Graceful shutdown handler
