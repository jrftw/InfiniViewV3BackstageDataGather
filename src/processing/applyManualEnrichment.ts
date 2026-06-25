/**
 * Filename: applyManualEnrichment.ts
 * Purpose: Apply manual enrichment from Google Sheets tab to combined creator records.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Node.js 18+
 */

import { normalizeBackstageCreatorId } from "./normalizeCreatorId";
import { normalizeTikTokUsername } from "./normalizeUsername";
import { CombinedCreatorRecord } from "./mergeBackstageReports";

// MARK: - Enrichment Types

export interface ManualEnrichmentRow {
  backstage_creator_id?: string | null;
  tiktok_username?: string | null;
  email?: string | null;
  phone?: string | null;
  crm_contact_id?: string | null;
  preferred_manager?: string | null;
  manual_notes?: string | null;
  do_not_reassign?: string | boolean | null;
  special_status?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

// MARK: - Enrichment Application

export function applyManualEnrichmentToCreators(
  creators: CombinedCreatorRecord[],
  enrichmentRows: ManualEnrichmentRow[]
): { creators: CombinedCreatorRecord[]; appliedCount: number } {
  const byId = new Map<string, ManualEnrichmentRow>();
  const byUsername = new Map<string, ManualEnrichmentRow>();
  const byEmail = new Map<string, ManualEnrichmentRow>();
  const byPhone = new Map<string, ManualEnrichmentRow>();

  for (const row of enrichmentRows) {
    const id = normalizeBackstageCreatorId(row.backstage_creator_id);
    const username = normalizeTikTokUsername(row.tiktok_username);
    const email = row.email?.trim().toLowerCase();
    const phone = row.phone?.replace(/\D/g, "");

    if (id) byId.set(id, row);
    if (username) byUsername.set(username, row);
    if (email) byEmail.set(email, row);
    if (phone) byPhone.set(phone, row);
  }

  let appliedCount = 0;

  const enriched = creators.map((creator) => {
    let match: ManualEnrichmentRow | undefined;

    if (creator.backstage_creator_id && byId.has(creator.backstage_creator_id)) {
      match = byId.get(creator.backstage_creator_id);
    } else if (creator.normalized_username && byUsername.has(creator.normalized_username)) {
      match = byUsername.get(creator.normalized_username);
    } else if (creator.email && byEmail.has(creator.email.toLowerCase())) {
      match = byEmail.get(creator.email.toLowerCase());
    } else if (creator.phone && byPhone.has(creator.phone.replace(/\D/g, ""))) {
      match = byPhone.get(creator.phone.replace(/\D/g, ""));
    }

    if (!match) {
      return creator;
    }

    appliedCount++;

    const doNotReassign =
      match.do_not_reassign === true ||
      String(match.do_not_reassign ?? "").toLowerCase() === "yes" ||
      String(match.do_not_reassign ?? "").toLowerCase() === "true";

    return {
      ...creator,
      email: match.email ?? creator.email,
      phone: match.phone ?? creator.phone,
      crm_contact_id: match.crm_contact_id ?? creator.crm_contact_id,
      preferred_manager: match.preferred_manager ?? creator.preferred_manager,
      manual_notes: match.manual_notes ?? creator.manual_notes,
      special_status: match.special_status ?? creator.special_status,
      do_not_reassign: doNotReassign || creator.do_not_reassign,
    };
  });

  return { creators: enriched, appliedCount };
}

// Suggestions For Features and Additions Later:
// - Change log diff when enrichment overrides fields
