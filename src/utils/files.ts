/**
 * Filename: files.ts
 * Purpose: File system helpers for directories and safe writes.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

import fs from "fs";
import path from "path";

// MARK: - Directory Helpers

export function gathererEnsureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function gathererWriteJsonFile(filePath: string, data: unknown): void {
  gathererEnsureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function gathererReadJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function gathererCopyFile(source: string, destination: string): void {
  gathererEnsureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

// Suggestions For Features and Additions Later:
// - Async file IO for large exports
