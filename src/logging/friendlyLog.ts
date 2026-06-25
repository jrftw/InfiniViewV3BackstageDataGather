/**
 * Filename: friendlyLog.ts
 * Purpose: Human-readable console output with emoji status markers for gatherer runs.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+ (Windows server PC)
 */

// MARK: - Toggle

export function isGathererFriendlyLoggingEnabled(): boolean {
  if (process.env.GATHERER_FRIENDLY_LOGS === "false") {
    return false;
  }
  return true;
}

// MARK: - Format Helpers

const GATHERER_FRIENDLY_DIVIDER = "─".repeat(56);

function gathererFriendlyTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function gathererFriendlyWrite(line: string): void {
  console.log(line);
}

// MARK: - Public API

export function gathererLogBanner(title: string, subtitle?: string): void {
  if (!isGathererFriendlyLoggingEnabled()) return;
  gathererFriendlyWrite("");
  gathererFriendlyWrite(`🚀 ${title}`);
  if (subtitle) {
    gathererFriendlyWrite(`   ${subtitle}`);
  }
  gathererFriendlyWrite(GATHERER_FRIENDLY_DIVIDER);
}

export function gathererLogSection(title: string): void {
  if (!isGathererFriendlyLoggingEnabled()) return;
  gathererFriendlyWrite("");
  gathererFriendlyWrite(`📋 ${title}`);
}

export function gathererLogOk(message: string, detail?: string): void {
  if (!isGathererFriendlyLoggingEnabled()) return;
  gathererFriendlyWrite(`   ✅ ${message}${detail ? ` — ${detail}` : ""}`);
}

export function gathererLogWarn(message: string, detail?: string): void {
  if (!isGathererFriendlyLoggingEnabled()) return;
  gathererFriendlyWrite(`   ⚠️  ${message}${detail ? ` — ${detail}` : ""}`);
}

export function gathererLogFail(message: string, detail?: string): void {
  if (!isGathererFriendlyLoggingEnabled()) return;
  gathererFriendlyWrite(`   ❌ ${message}${detail ? ` — ${detail}` : ""}`);
}

export function gathererLogInfo(message: string, detail?: string): void {
  if (!isGathererFriendlyLoggingEnabled()) return;
  gathererFriendlyWrite(`   ℹ️  ${message}${detail ? ` — ${detail}` : ""}`);
}

export function gathererLogProgress(step: number, total: number, message: string): void {
  if (!isGathererFriendlyLoggingEnabled()) return;
  gathererFriendlyWrite(`   ▶️  [${step}/${total}] ${message}`);
}

export function gathererLogWorking(message: string): void {
  if (!isGathererFriendlyLoggingEnabled()) return;
  gathererFriendlyWrite(`   🔄 ${message}…`);
}

export function gathererLogDone(message: string, detail?: string): void {
  if (!isGathererFriendlyLoggingEnabled()) return;
  gathererFriendlyWrite("");
  gathererFriendlyWrite(`🎉 ${message}${detail ? ` — ${detail}` : ""}`);
  gathererFriendlyWrite(GATHERER_FRIENDLY_DIVIDER);
}

export function gathererLogFatal(message: string, detail?: string): void {
  if (!isGathererFriendlyLoggingEnabled()) return;
  gathererFriendlyWrite("");
  gathererFriendlyWrite(`🛑 ${message}${detail ? ` — ${detail}` : ""}`);
  gathererFriendlyWrite(GATHERER_FRIENDLY_DIVIDER);
}

export function gathererLogTime(message: string): void {
  if (!isGathererFriendlyLoggingEnabled()) return;
  gathererFriendlyWrite(`   🕐 ${gathererFriendlyTimestamp()} — ${message}`);
}

// Suggestions For Features and Additions Later:
// - Optional log file mirror with plain-text friendly format
