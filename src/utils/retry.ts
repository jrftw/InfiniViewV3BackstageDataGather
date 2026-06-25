/**
 * Filename: retry.ts
 * Purpose: Generic retry wrapper for flaky browser/network operations.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

import { logDebug, logError } from "../logging/logger";

// MARK: - Retry Options

export interface GathererRetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  source?: string;
}

// MARK: - Retry Wrapper

export async function gathererRetry<T>(
  operation: () => Promise<T>,
  options: GathererRetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delayMs = options.delayMs ?? 2000;
  const source = options.source ?? "retry";

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logError(`Attempt ${attempt}/${maxAttempts} failed`, source, {
        error: error instanceof Error ? error.message : String(error),
      });
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError;
}

// Suggestions For Features and Additions Later:
// - Exponential backoff with jitter
