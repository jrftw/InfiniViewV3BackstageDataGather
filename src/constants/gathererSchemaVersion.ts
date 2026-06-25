/**
 * Filename: gathererSchemaVersion.ts
 * Purpose: Stable creator master schema identifier for sheet rows and JSON cache compatibility.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-24
 * Platform Compatibility: Node.js 18+
 */

// MARK: - Schema Version (bump only when CombinedCreatorRecord columns change materially)

/** Stable schema id — does not change per import run. */
export const GATHERER_CREATOR_SCHEMA_VERSION = "creator_master_v1";

// Suggestions For Features and Additions Later:
// - Bump to creator_master_v2 when master column layout changes materially
