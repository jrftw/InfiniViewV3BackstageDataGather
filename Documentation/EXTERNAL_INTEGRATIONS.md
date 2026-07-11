# External Integrations — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## TikTok LIVE Backstage

| | |
|---|---|
| **Purpose** | Export management roster and creator performance Excel reports |
| **Direction** | Read-only via browser automation |
| **Auth** | Playwright saved session + optional email/password in `.env` |
| **Config** | `BACKSTAGE_*` variables |
| **Source files** | `src/backstage/*` |
| **Error handling** | Job failure, optional failure email |
| **Fallbacks** | Re-login; force US+ region switch |
| **Status** | Implemented with external configuration required |
| **Local dev** | Visible browser recommended |
| **Production** | Headless on server PC |

---

## TikTok public web (Profile Acquirer)

| | |
|---|---|
| **Purpose** | Avatar, bio, follower counts, recent videos |
| **Direction** | Read public pages / oEmbed |
| **Auth** | None (public scrape) |
| **Config** | `GATHERER_PROFILE_ACQUIRER_*` |
| **Source files** | `src/profileAcquirer/*` |
| **Error handling** | Per-creator skip + log |
| **Rate limits** | Batch limit 25 default; stale hours 24 |
| **Status** | Implemented |
| **Privacy** | Public data only |

---

## Google Drive API

| | |
|---|---|
| **Purpose** | Upload raw/processed exports, daily archives, profile images |
| **Direction** | Write (+ read for snapshot history import) |
| **Auth** | Service account JWT; optional domain-wide delegation |
| **Config** | `GOOGLE_*`, folder IDs |
| **Source files** | `src/google/driveClient.ts`, `uploadDriveFile.ts`, `archiveDailySheetToDrive.ts` |
| **Error handling** | Publish failure fails gather |
| **Quota** | Uses delegated user My Drive when configured |
| **Status** | Implemented with external configuration required |

---

## Google Sheets API

| | |
|---|---|
| **Purpose** | Master creators tab, sync tabs, read CRM/DIP/manual enrichment |
| **Direction** | Read + write |
| **Auth** | Same service account |
| **Config** | Sheet IDs and tab names |
| **Source files** | `src/google/sheetsClient.ts`, `publishMasterCreatorsTab.ts`, enrichment readers |
| **Incremental updates** | Checksum-based row patch (default on) |
| **Status** | Implemented with external configuration required |

---

## Gmail API (failure notifications)

| | |
|---|---|
| **Purpose** | Email operator when gather fails |
| **Direction** | Write (send) |
| **Auth** | Delegated service account with `gmail.send` |
| **Config** | `GATHERER_FAILURE_EMAIL_*`, `GOOGLE_DELEGATED_USER` |
| **Source files** | `src/notifications/gathererFailureEmailNotifier.ts` |
| **Failure behavior** | Logged; does not fail gather retroactively |
| **Status** | Implemented with external configuration required |

---

## MongoDB Atlas

| | |
|---|---|
| **Purpose** | Production creator + snapshot data for InfiniView API |
| **Direction** | Read existing + upsert writes |
| **Auth** | `MONGODB_URI` connection string |
| **Database** | `InfiniViewV3` (default) |
| **Collections** | 6 — see DATA_FLOW_AND_SOURCES.md |
| **Source files** | `src/mongo/*` |
| **Indexes** | Bootstrapped at publish time |
| **Status** | Implemented with external configuration required |
| **Local dev** | Optional — gather works without URI for file-only mode |

---

## InfiniView API (Cloud Functions)

| | |
|---|---|
| **Purpose** | Community highlights scan after snapshots |
| **Direction** | Gatherer POST → API |
| **Endpoint** | `POST /internal/community/highlights/scan` |
| **Auth** | Bearer `INFINIVIEW_INTERNAL_SERVICE_SECRET` |
| **Config** | `INFINIVIEW_API_BASE_URL`, scan enable flags |
| **Source files** | `src/services/gathererInfiniviewCommunityHighlightScanClient.ts` |
| **Failure behavior** | Warning only |
| **Status** | **Disabled by default** |
| **Schedule** | Hourly 8 AM–8 PM ET when enabled |

---

## Infinitum Server Agent

| | |
|---|---|
| **Purpose** | Optional post-publish warehouse / summary sync |
| **Direction** | Gatherer → Agent HTTP |
| **Auth** | `INFINITUM_AGENT_API_TOKEN` |
| **Config** | `INFINITUM_AGENT_*` |
| **Source files** | `src/services/gathererInfinitumAgentPostPublish.ts`, `infinitumServerAgentClient.ts` |
| **Failure behavior** | Warning only — gather succeeds |
| **Status** | Disabled by default |
| **Network** | Expected LAN (e.g. `10.0.0.x`) |

---

## GitHub

| | |
|---|---|
| **Purpose** | Auto-update server PC from `main` |
| **Direction** | Read (pull) |
| **Auth** | Git credentials on server PC |
| **Config** | `GIT_UPDATE_BRANCH`, `GIT_UPDATE_CHECK_MINUTES` |
| **Source files** | `src/gitAutoUpdate.ts`, `scripts/auto-update.ps1` |
| **Status** | Implemented |

---

## Integration status summary

| Integration | Required for production | Verified live in audit |
|-------------|----------------------|------------------------|
| Backstage | Yes | Unable to verify |
| Google Drive/Sheets | Yes (typical) | Unable to verify |
| MongoDB | Strongly recommended | Unable to verify |
| TikTok public | Optional enrichment | Unable to verify |
| InfiniView highlight API | Optional | Unable to verify |
| Infinitum Agent | Optional | Unable to verify |
| Gmail alerts | Optional | Unable to verify |
