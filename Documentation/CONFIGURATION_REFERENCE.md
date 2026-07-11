# Configuration Reference — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11  
**Template:** `.env.example`  
**Loader:** `src/config.ts` → `loadGathererConfig()`

Restart the Node process after changing `.env` (except git update watcher reads on interval).

---

## Runtime

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `production` | Node environment |
| `TZ` | No | `America/New_York` | Process timezone for cron |
| `APP_PORT` | No | `3099` | Express dashboard port |

---

## Backstage browser

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKSTAGE_BASE_URL` | No | `https://live-backstage.tiktok.com` | Backstage portal URL |
| `BACKSTAGE_AUTH_STATE_PATH` | No | `data/auth/backstage-auth.json` | Saved Playwright session |
| `BACKSTAGE_EMAIL` | For auto-login | — | Agency login email |
| `BACKSTAGE_PASSWORD` | For auto-login | — | Agency login password |
| `TIKTOK_EMAIL` / `TIKTOK_PASSWORD` | Aliases | — | Same as BACKSTAGE_* |
| `BACKSTAGE_HEADLESS` | No | headless true | `false` shows browser |
| `HEADLESS` | Alias | — | `false` / `true` override |
| `BACKSTAGE_SLOW_MO_MS` | No | `0` | Slow motion ms for debugging |
| `BACKSTAGE_LOCALE` | No | `en-US` | Browser locale |
| `BACKSTAGE_TIMEZONE` | No | `America/New_York` | Browser timezone |
| `BACKSTAGE_REGION` | No | `US` | Region code |
| `BACKSTAGE_ACCEPT_LANGUAGE` | No | `en-US,en;q=0.9` | Accept-Language header |
| `BACKSTAGE_GEO_LAT` / `BACKSTAGE_GEO_LNG` | No | NYC coords | Geolocation hint |
| `BACKSTAGE_AGENCY_REGION` | No | `US+` | Agency region selector target |
| `BACKSTAGE_FORCE_US_PLUS` | No | `true` | Auto-switch to US+ |
| `BACKSTAGE_PERFORMANCE_DATE_RANGE` | No | `month` | `month` or `rolling` |
| `BACKSTAGE_PERFORMANCE_DAYS` | No | `30` | Days for rolling range |
| `GATHERER_PERFORMANCE_COLUMN_RESET` | No | `true` | Column reset on export retry |
| `GATHERER_CREATOR_DATA_L30D_PERIOD_FALLBACK` | No | `true` | L30D column label fallback |
| `GATHERER_BACKSTAGE_FORCE_RELOGIN_HOURS` | No | `8` | Delete auth file after N hours (`0`=never) |

---

## Google

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | For publish | — | Service account client email |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | For publish | — | PEM key (`\n` escaped) |
| `GOOGLE_DELEGATED_USER` | For Gmail/delegation | — | Workspace user to impersonate |
| `GOOGLE_SCOPES` | No | drive+spreadsheets | Comma-separated OAuth scopes |
| `GOOGLE_DRIVE_FOLDER_ID` | For publish | — | Data hub folder |
| `GOOGLE_DRIVE_DAILY_ARCHIVE_FOLDER_ID` | No | — | Daily archive folder |
| `GOOGLE_MASTER_SHEET_ID` | For publish | — | Master creators spreadsheet |
| `GOOGLE_CRM_SHEET_ID` | No | example ID in template | External CRM sheet |
| `GOOGLE_CRM_SHEET_TAB` | No | leftmost tab | CRM tab name |
| `GOOGLE_DIP_SHEET_ID` | No | example ID in template | DIP sheet |
| `GOOGLE_DIP_SHEET_TAB` / `GOOGLE_DIP_SHEET_GID` | No | — | DIP tab resolution |
| `GOOGLE_DRIVE_PROFILE_IMAGES_SUBFOLDER` | No | `Profile Pictures` | Subfolder name |
| `GOOGLE_DRIVE_PROFILE_IMAGES_FOLDER_ID` | No | — | Optional dedicated folder |

---

## Local paths

| Variable | Default |
|----------|---------|
| `LOCAL_DOWNLOAD_DIR` | `data/downloads` |
| `LOCAL_RAW_DIR` | `data/raw` |
| `LOCAL_PROCESSED_DIR` | `data/processed` |
| `LOCAL_LOG_DIR` | `data/logs` |
| `LOCAL_CACHE_DIR` | `cache/creators` |

---

## Scheduling

| Variable | Default | Description |
|----------|---------|-------------|
| `RUN_SCHEDULE_1`–`RUN_SCHEDULE_4` | 08:00, 12:00, 16:00, 20:00 | Fixed schedule times |
| `RUN_SCHEDULES` | — | Comma-separated override (24 hourly example in template) |
| `GATHERER_SCHEDULE_MODE` | `fixed` | `fixed` or `random` |
| `GATHERER_RUNS_PER_DAY` | `24` in template / `10` in code fallback | Random mode count |
| `GATHERER_ACTIVE_HOURS_START` | `00:00` in template | Random mode window |
| `GATHERER_ACTIVE_HOURS_END` | `23:59` in template | Random mode window |
| `GATHERER_RUN_JITTER_MINUTES` | `0` in template | Random jitter |
| `GATHERER_MIN_MINUTES_BETWEEN_RUNS` | `50` | Cooldown between runs |
| `GATHERER_DAILY_ARCHIVE_TIME` | `20:00` | Business day cutoff (ET) |
| `GATHERER_CATCHUP_ON_STARTUP` | `true` | Missed-run recovery on boot |

---

## Output / retention

| Variable | Default | Description |
|----------|---------|-------------|
| `KEEP_LOCAL_FILES_DAYS` | `14` | Local file cleanup |
| `GATHERER_KEEP_RAW_PAIRS_PER_DAY` | `4` | Raw export pairs retained |
| `GATHERER_DAILY_SHEET_TAB_PREFIX` | `Daily` | Daily tab prefix |
| `GATHERER_UPDATE_MASTER_DAILY_TAB` | `false` | Write daily tab on master sheet |
| `GATHERER_MASTER_SHEET_INCREMENTAL_UPDATES` | `true` | Checksum-based row patch |

---

## Creator filtering

| Variable | Default | Description |
|----------|---------|-------------|
| `GATHERER_REQUIRE_MANAGEMENT_MATCH` | `true` | Only creators in management export |
| `GATHERER_REQUIRE_EFFECTIVE_RELATIONSHIP` | `true` | Require Effective relationship |
| `GATHERER_EXCLUDE_GRADUATION_STATUSES` | `quit,removed,expired` | Excluded statuses |

---

## Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `GATHERER_FRIENDLY_LOGS` | `true` | Emoji console logs |
| `GATHERER_VERBOSE_STEPS` | `true` | Step-by-step logging |
| `GATHERER_ENABLE_DEBUG_LOGGING` | auto | `true` or non-production enables debug |

---

## Profile Acquirer

| Variable | Default | Description |
|----------|---------|-------------|
| `GATHERER_PROFILE_ACQUIRER_ENABLED` | `true` | Master enable |
| `GATHERER_PROFILE_ACQUIRER_AFTER_BACKSTAGE` | `true` in template | Chain after gather |
| `GATHERER_PROFILE_ACQUIRER_AFTER_BACKSTAGE_NEW_ONLY` | `false` in template | New creators only |
| `GATHERER_PROFILE_ACQUIRER_STALE_HOURS` | `24` | Skip recently checked |
| `GATHERER_PROFILE_ACQUIRER_BATCH_LIMIT` | `25` | Max per batch |
| `GATHERER_PROFILE_ACQUIRER_BROWSER_VIDEOS` | `true` | Playwright for videos |
| `GATHERER_PROFILE_ACQUIRER_TIKTOK_HEADLESS` | `true` | Headless TikTok scrape |

---

## Git auto-update

| Variable | Default | Description |
|----------|---------|-------------|
| `GIT_UPDATE_BRANCH` | `main` | Branch to watch |
| `GIT_UPDATE_CHECK_MINUTES` | `15` | Poll interval |

---

## MongoDB

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | For dual-write | empty | Atlas connection string |
| `MONGODB_DB_NAME` | No | `InfiniViewV3` | Database name |
| `GATHERER_MONGODB_ENABLED` | No | `true` | Enable Mongo publish |
| `GATHERER_MONGO_SNAPSHOT_ONE_PER_DAY` | No | `true` | Dedupe daily snapshots |
| `GATHERER_MONGODB_DNS_SERVERS` | No | — | Optional SRV DNS override |

---

## Snapshot history

| Variable | Default | Description |
|----------|---------|-------------|
| `GATHERER_SNAPSHOT_HISTORY_IMPORT_ENABLED` | `true` | Nightly import job |
| `GATHERER_SNAPSHOT_HISTORY_IMPORT_TIME` | `00:30` | Cron time ET |
| `GATHERER_SNAPSHOT_HISTORY_COMBINED_TAB` | `Combined Creators` | Tab name in archives |

---

## Auto Highlights scan

| Variable | Default | Description |
|----------|---------|-------------|
| `GATHERER_AUTO_HIGHLIGHTS_SCAN_ENABLED` | **`false`** | Opt-in master switch |
| `GATHERER_AUTO_HIGHLIGHTS_SCAN_ACTIVE_HOUR_START` | `8` | Start hour ET |
| `GATHERER_AUTO_HIGHLIGHTS_SCAN_ACTIVE_HOUR_END` | `20` | End hour ET |
| `INFINIVIEW_API_BASE_URL` | Cloud Function URL | API base |
| `INFINIVIEW_INTERNAL_SERVICE_SECRET` | empty | Bearer token |
| `INFINIVIEW_HIGHLIGHT_SCAN_TIMEOUT_MS` | `15000` | Request timeout |

---

## Infinitum Agent

| Variable | Default | Description |
|----------|---------|-------------|
| `INFINITUM_AGENT_ENABLED` | `false` | Enable hooks |
| `INFINITUM_AGENT_BASE_URL` | example LAN IP | Agent URL |
| `INFINITUM_AGENT_API_TOKEN` | empty | Internal token |
| `INFINITUM_AGENT_TIMEOUT_MS` | `5000` | HTTP timeout |

---

## Failure email

| Variable | Default | Description |
|----------|---------|-------------|
| `GATHERER_FAILURE_EMAIL_ENABLED` | `true` | Send on gather failure |
| `GATHERER_FAILURE_EMAIL_TO` | owner email in template | Recipient |
| `GATHERER_FAILURE_EMAIL_FROM` | delegated user | Sender |

---

## Secret ownership

| Secret | Owner | Storage |
|--------|-------|---------|
| Backstage password | Agency operator | `.env` only |
| Google private key | Google Cloud admin | `.env` only |
| MongoDB URI | DBA | `.env` only |
| InfiniView internal secret | InfiniView API deploy | `.env` only |
| Agent token | Server agent admin | `.env` only |

---

## Runtime vs restart required

| Change | Restart needed |
|--------|----------------|
| Schedule times | Yes |
| Mongo/Google credentials | Yes |
| `GATHERER_AUTO_HIGHLIGHTS_SCAN_ENABLED` | Yes |
| Git branch watched | Yes (or wait for poll) |
| Log verbosity | Yes |

Git auto-update performs its own rebuild without manual restart when update applies (process exit + batch loop).
