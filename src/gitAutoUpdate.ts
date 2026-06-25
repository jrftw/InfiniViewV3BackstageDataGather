/**
 * Filename: gitAutoUpdate.ts
 * Purpose: Poll GitHub for updates, pull, rebuild, and restart on server PC.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+ (Windows server PC with git)
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { GathererConfig } from "./config";
import { logInfo, logError } from "./logging/logger";

// MARK: - Git Helpers

function gathererGitExec(command: string, cwd: string): string {
  return execSync(command, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function gathererGetLocalHead(projectRoot: string): string {
  return gathererGitExec("git rev-parse HEAD", projectRoot);
}

function gathererGetRemoteHead(projectRoot: string, branch: string): string {
  gathererGitExec("git fetch origin", projectRoot);
  return gathererGitExec(`git rev-parse origin/${branch}`, projectRoot);
}

// MARK: - Update Check

export interface GitAutoUpdateResult {
  updated: boolean;
  message: string;
}

export function checkAndApplyGitUpdate(config: GathererConfig): GitAutoUpdateResult {
  const lockFile = path.join(config.projectRoot, ".update-lock");

  if (fs.existsSync(lockFile)) {
    return { updated: false, message: "Update already in progress" };
  }

  try {
    if (!fs.existsSync(path.join(config.projectRoot, ".git"))) {
      return { updated: false, message: "Not a git repository — clone from GitHub first" };
    }

    const localHead = gathererGetLocalHead(config.projectRoot);
    const remoteHead = gathererGetRemoteHead(config.projectRoot, config.gitUpdateBranch);

    if (localHead === remoteHead) {
      return { updated: false, message: "Already up to date" };
    }

    fs.writeFileSync(lockFile, new Date().toISOString(), "utf-8");
    logInfo(`Updating from ${localHead.slice(0, 7)} to ${remoteHead.slice(0, 7)}`, "gitAutoUpdate");

    gathererGitExec(`git pull origin ${config.gitUpdateBranch}`, config.projectRoot);
    gathererGitExec("npm ci", config.projectRoot);
    gathererGitExec("npm run build", config.projectRoot);

    logInfo("Git auto-update completed — restart server to apply", "gitAutoUpdate");
    return {
      updated: true,
      message: `Updated to ${remoteHead.slice(0, 7)}. Restart the server.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("Git auto-update failed", "gitAutoUpdate", { error: message });
    return { updated: false, message };
  } finally {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  }
}

// MARK: - Update Watcher Interval

export function startGitAutoUpdateWatcher(config: GathererConfig): NodeJS.Timeout {
  const intervalMs = config.gitUpdateCheckMinutes * 60 * 1000;

  logInfo(
    `Git auto-update watcher started (every ${config.gitUpdateCheckMinutes} min)`,
    "gitAutoUpdate"
  );

  return setInterval(() => {
    const result = checkAndApplyGitUpdate(config);
    if (result.updated) {
      logInfo(result.message, "gitAutoUpdate");
      process.exit(0);
    }
  }, intervalMs);
}

// Suggestions For Features and Additions Later:
// - GitHub webhook endpoint for instant updates
