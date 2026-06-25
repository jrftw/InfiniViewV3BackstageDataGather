/**
 * Filename: gathererBasenameFilePath.ts
 * Purpose: Store export filenames (not full local paths) on master creator rows.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Platform Compatibility: Node.js 18+
 */

import path from "path";

// MARK: - Basename Helper

export function gathererBasenameFilePath(filePath: string | null | undefined): string {
  if (!filePath) {
    return "";
  }
  const trimmed = String(filePath).trim();
  if (!trimmed) {
    return "";
  }
  return path.basename(trimmed.replace(/\\/g, "/"));
}

// Suggestions For Features and Additions Later:
// - Preserve relative data/raw/ prefix when configured
