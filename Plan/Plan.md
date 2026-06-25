# InfiniView V3 Backstage Gatherer — Build Plan

> **How to run this project:** see [HOW_TO_RUN.md](./HOW_TO_RUN.md)

## Main decision

Your engineer is right:

```txt
Google Sheets is not the database.
```

But for this phase, we are **not using Google Sheets as the final database**.

We are using it as a:

```txt
staging layer
review layer
backup output
human-readable data hub
temporary operations bridge
```

The actual gatherer should be built so we can later switch from Google Sheets to:

```txt
MongoDB
Supabase/Postgres
Firebase
Custom API
InfiniView V3 database
```

without rebuilding the Backstage automation.

---

# Core goal

Build a local server app that runs on your server PC 24/7.

It will:

```txt
1. Open Backstage automatically
2. Export two required Backstage reports
3. Save raw exports locally
4. Parse both reports
5. Combine creators by Creator ID
6. Save clean output locally
7. Upload raw + clean files to Google Drive
8. Update Google Sheets for easy review
9. Run automatically 4 times per day
10. Allow manual run anytime
```

---

# Simple system layout

```txt
Backstage
   ↓
Playwright Gatherer
   ↓
Raw Export A + Raw Export B
   ↓
Parser / Normalizer
   ↓
Combined Creator Dataset
   ↓
Outputs:
   - Local files
   - Google Drive files
   - Google Sheet tabs
   - JSON file ready for future database
```

---

# Best technology stack

Use:

```txt
Node.js
TypeScript
Playwright
xlsx
googleapis
node-cron
Express
Pino logger
dotenv
```

Why:

```txt
Node/TypeScript = reliable and familiar
Playwright = better browser automation than Puppeteer
xlsx = reads/writes Excel files
googleapis = Drive + Sheets integration
node-cron = schedule 4 daily runs
Express = manual run button/API
Pino = clean logs
dotenv = secure config
```

---

# What Google Sheets is allowed to be

Google Sheets can be:

```txt
Latest visible master list
Import review table
Unmatched creators table
Error log
Manual notes/enrichment source
Quick export/report tool
```

Google Sheets should **not** be:

```txt
Final database
Main app backend
Long-term history engine
High-traffic API
Source of truth for Backstage performance
```

This keeps your engineer happy because the architecture is not pretending Sheets is a database.

---

# Source of truth rules

```txt
Backstage = current creator performance source of truth
Google Drive = raw export archive
Google Sheets = human-readable staging/review layer
Local JSON/CSV/XLSX = portable output
Future database = real InfiniView V3 storage
CRM = relationship/contact history
```

---

# Required Backstage exports

## Export A: Performance / analytics report

Fields expected:

```txt
Creator
Creator ID
Joined time
Days since joining
Graduation status
Tier status
Total Diamonds
Fan Club total Diamonds
Fan contribution %
Active fans from Fan Club
Total fans
New fans
LIVE streams
LIVE duration
Valid go LIVE days
New followers
New LIVE creator this month
Diamonds from multi-guest
Diamonds from multi-guest as host
Diamonds from multi-guest as guest
Matches
Diamonds from matches
```

## Export B: Management / creator profile report

Fields expected:

```txt
Creator
Creator ID
Notes
LIVE duration in L30D
Valid go LIVE days in L30D
Diamonds in L30D
Joined time
Days since joining
Last LIVE
Relationship status
Graduation status
Tier status
Tier last month
Followers
Active fans from Fan Club in L30D
Videos
Diamonds from Fan Club in L30D
Management relationship dates
Renewed management relationship dates
Likes
Invitation type
Promote permission
Subscription status
Invited by
Action
```

---

# Merge rule

Primary match:

```txt
Creator ID
```

Fallback match:

```txt
Normalized TikTok username
```

Do not merge by display name.

Example:

```txt
queenwidivybz
7359135855103475718
```

Both exports become one creator record.

---

# Output files per run

Every run should create:

```txt
backstage-performance-YYYY-MM-DD-HHmm.xlsx
backstage-management-YYYY-MM-DD-HHmm.xlsx
combined-creators-YYYY-MM-DD-HHmm.xlsx
combined-creators-YYYY-MM-DD-HHmm.csv
combined-creators-YYYY-MM-DD-HHmm.json
import-summary-YYYY-MM-DD-HHmm.json
```

This is important because:

```txt
XLSX = easy human review
CSV = easy import/export
JSON = future database-ready
summary JSON = debugging/logging
```

---

# Google Drive folder structure

```txt
InfiniView V3 Backstage Gatherer/
├── Raw Backstage Exports/
│   ├── 2026-06-23/
│   │   ├── backstage-performance-2026-06-23-0800.xlsx
│   │   └── backstage-management-2026-06-23-0800.xlsx
│
├── Combined Outputs/
│   ├── 2026-06-23/
│   │   ├── combined-creators-2026-06-23-0800.xlsx
│   │   ├── combined-creators-2026-06-23-0800.csv
│   │   └── combined-creators-2026-06-23-0800.json
│
├── Import Summaries/
│   ├── 2026-06-23/
│   │   └── import-summary-2026-06-23-0800.json
│
└── InfiniView V3 Latest Master Sheet
```

---

# Google Sheet tabs

The master Google Sheet should have these tabs:

```txt
01_Latest_Master_Creators
02_Performance_Raw_Latest
03_Management_Raw_Latest
04_Import_Log
05_Unmatched_Rows
06_Errors
07_Change_Log
08_Manual_Enrichment
09_CRM_Link_Queue
```

## Important

Only these tabs should be overwritten automatically:

```txt
01_Latest_Master_Creators
02_Performance_Raw_Latest
03_Management_Raw_Latest
04_Import_Log
05_Unmatched_Rows
06_Errors
07_Change_Log
09_CRM_Link_Queue
```

This tab should **not** be overwritten:

```txt
08_Manual_Enrichment
```

That gives you a safe place to add:

```txt
email
phone
preferred manager
notes
CRM contact ID
manual flags
```

---

# Best Google Sheets strategy

The gatherer should treat Google Sheets like this:

```txt
Read manual enrichment tab
Run Backstage export
Combine Backstage data
Apply enrichment by Creator ID / username
Write final master tab
```

So your flow becomes:

```txt
Backstage data
+ Manual enrichment from Sheets
= Latest Master Creators
```

But Backstage performance still wins.

---

# Manual enrichment rules

The `08_Manual_Enrichment` tab should have:

```txt
backstage_creator_id
tiktok_username
email
phone
crm_contact_id
preferred_manager
manual_notes
do_not_reassign
special_status
updated_by
updated_at
```

Matching order:

```txt
1. backstage_creator_id
2. normalized tiktok_username
3. email
4. phone
```

Backstage owns:

```txt
diamonds
hours
valid days
followers
last LIVE
tier status
graduation status
management dates
```

Manual enrichment owns:

```txt
email
phone
CRM contact ID
special notes
do not reassign flags
manual internal labels
```

---

# Scheduled runs

Run 4 times daily Eastern Time:

```txt
8:00 AM
12:00 PM
4:00 PM
8:00 PM
```

Also include:

```txt
Manual Run button
Manual Run API endpoint
Manual Run .bat file
```

Example:

```txt
npm run gather
```

or:

```txt
run-now.bat
```

or:

```txt
http://localhost:3099/run-now
```

---

# Login approach

Use saved browser session.

Flow:

```txt
1. Run npm run login
2. Browser opens
3. You manually log into Backstage
4. Script saves session to data/auth/backstage-auth.json
5. Future runs reuse the saved session
```

If Backstage logs out:

```txt
npm run login
```

again.

No storing your password in code.

---

# Project folder structure

```txt
infiniview-v3-backstage-gatherer/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── run-now.bat
├── start-server.bat
│
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── scheduler.ts
│   ├── config.ts
│   │
│   ├── backstage/
│   │   ├── browser.ts
│   │   ├── loginOnce.ts
│   │   ├── exportPerformanceReport.ts
│   │   ├── exportManagementReport.ts
│   │   ├── backstageSelectors.ts
│   │   └── backstageExportRunner.ts
│   │
│   ├── processing/
│   │   ├── parseWorkbook.ts
│   │   ├── normalizeCreatorId.ts
│   │   ├── normalizeUsername.ts
│   │   ├── normalizeNumbers.ts
│   │   ├── normalizeDurations.ts
│   │   ├── mergeBackstageReports.ts
│   │   ├── applyManualEnrichment.ts
│   │   └── buildOutputs.ts
│   │
│   ├── google/
│   │   ├── googleAuth.ts
│   │   ├── driveClient.ts
│   │   ├── sheetsClient.ts
│   │   ├── uploadDriveFile.ts
│   │   ├── updateSheetTabs.ts
│   │   └── readManualEnrichment.ts
│   │
│   ├── jobs/
│   │   ├── runGathererJob.ts
│   │   ├── validateRun.ts
│   │   └── cleanupOldLocalFiles.ts
│   │
│   ├── logging/
│   │   ├── logger.ts
│   │   └── importSummary.ts
│   │
│   └── utils/
│       ├── dates.ts
│       ├── files.ts
│       ├── retry.ts
│       └── safeJson.ts
│
├── data/
│   ├── auth/
│   ├── downloads/
│   ├── raw/
│   ├── processed/
│   ├── logs/
│   └── temp/
│
└── docs/
    ├── FIELD_MAP.md
    ├── GOOGLE_SHEETS_SETUP.md
    ├── BACKSTAGE_EXPORT_STEPS.md
    └── TROUBLESHOOTING.md
```

---

# Environment variables

`.env` should include:

```env
NODE_ENV=production
TZ=America/New_York

APP_PORT=3099

BACKSTAGE_BASE_URL=
BACKSTAGE_AUTH_STATE_PATH=data/auth/backstage-auth.json

GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_MASTER_SHEET_ID=

LOCAL_DOWNLOAD_DIR=data/downloads
LOCAL_RAW_DIR=data/raw
LOCAL_PROCESSED_DIR=data/processed
LOCAL_LOG_DIR=data/logs

RUN_SCHEDULE_1=08:00
RUN_SCHEDULE_2=12:00
RUN_SCHEDULE_3=16:00
RUN_SCHEDULE_4=20:00

KEEP_LOCAL_FILES_DAYS=30
```

---

# Data output model

Each combined creator row should include sections.

## Identity

```txt
backstage_creator_id
tiktok_username
display_name
normalized_username
```

## Status

```txt
joined_time
days_since_joining
graduation_status
tier_status
tier_last_month
relationship_status
last_live
```

## Current performance

```txt
diamonds_l30d
live_duration_l30d_hours
valid_live_days_l30d
followers
videos
likes
new_followers
live_streams
matches
diamonds_from_matches
```

## Fan Club

```txt
fan_club_total_diamonds
diamonds_from_fan_club_l30d
fan_contribution_percent
active_fans_from_fan_club
active_fans_from_fan_club_l30d
total_fans
new_fans
```

## Multi-guest

```txt
diamonds_from_multi_guest
diamonds_from_multi_guest_host
diamonds_from_multi_guest_guest
```

## Management

```txt
notes
management_start_date
management_end_date
renewed_management_start_date
renewed_management_end_date
invited_by
promote_permission
subscription_status
invitation_type
```

## Enrichment

```txt
email
phone
crm_contact_id
preferred_manager
manual_notes
special_status
do_not_reassign
```

## Import metadata

```txt
import_run_id
imported_at
source_performance_file
source_management_file
match_method
warnings
```

---

# Important parsing rules

The gatherer must normalize values.

## Diamonds

```txt
2.98M → 2980000
88.46K → 88460
4,001,930 → 4001930
```

## Days

```txt
1,055d → 1055
27d → 27
```

## Hours

```txt
119h 47m 31s → 119.79 hours
140.79h → 140.79 hours
```

## Percent

```txt
90.13% → 90.13
∞% → null with warning
```

## Empty values

```txt
- → null
blank → null
No → false where field is boolean
Yes → true where field is boolean
```

---

# Reliability requirements

The gatherer should have:

```txt
Retries
Timeouts
Screenshots on failure
Downloaded file validation
Missing column detection
Duplicate creator detection
Import summary
Error log
Manual rerun
Safe overwrite behavior
```

On failure, it should save:

```txt
screenshot
HTML snapshot if possible
error JSON
log file
partial files if available
```

---

# Manual run options

## Option 1: Command

```txt
npm run gather
```

## Option 2: Batch file

```txt
run-now.bat
```

## Option 3: Local browser button

```txt
http://localhost:3099
```

Buttons:

```txt
Run Gatherer Now
View Last Run
Open Logs Folder
Open Google Sheet
```

---

# What “little to no maintenance” means

To get close to that, the gatherer should avoid fragile selectors where possible.

Use:

```txt
Stable text labels
Download events
URL checks
Export button text
Retry wrappers
Configurable selectors file
Saved auth state
Clear error screenshots
```

Put all Backstage selectors in:

```txt
src/backstage/backstageSelectors.ts
```

So if Backstage changes a button, you edit one file instead of the whole project.

---

# Development phases

## Phase 1 — Local export automation

Goal:

```txt
Can the server PC open Backstage and download both exports?
```

Deliverables:

```txt
login-once command
manual gather command
raw files saved locally
failure screenshots
logs
```

---

## Phase 2 — Combine reports

Goal:

```txt
Can it combine both files into one clean creator dataset?
```

Deliverables:

```txt
combined XLSX
combined CSV
combined JSON
unmatched rows file
import summary
```

---

## Phase 3 — Google Drive output

Goal:

```txt
Can it upload every run to Google Drive?
```

Deliverables:

```txt
raw files uploaded
combined files uploaded
folder by date
summary uploaded
```

---

## Phase 4 — Google Sheets latest master

Goal:

```txt
Can it update a human-readable master Sheet?
```

Deliverables:

```txt
Latest Master Creators tab
Raw Performance Latest tab
Raw Management Latest tab
Import Log tab
Unmatched Rows tab
Errors tab
```

---

## Phase 5 — Manual enrichment

Goal:

```txt
Can it use your existing/manual Sheets data without becoming dependent on Sheets as a database?
```

Deliverables:

```txt
Manual Enrichment tab
Email/phone/CRM fields applied to master output
No overwriting manual data
Change log
```

---

## Phase 6 — Scheduling

Goal:

```txt
Can it run automatically 4 times/day and manually anytime?
```

Deliverables:

```txt
node-cron schedule
manual run button
run lock to prevent overlapping runs
last run status
logs
```

---

## Phase 7 — Future database adapter

Goal:

```txt
Can we later add MongoDB/Supabase without rewriting the gatherer?
```

Deliverables:

```txt
Database output interface
JSON output already compatible
Optional MongoDB adapter later
```

The architecture should have an output interface like:

```txt
OutputTarget
├── LocalFileOutput
├── GoogleDriveOutput
├── GoogleSheetsOutput
└── FutureDatabaseOutput
```

That way, Google Sheets is removable.

---

# What to tell your engineer

Tell them this:

```txt
Google Sheets is not being used as the production database. It is being used as a staging, review, and enrichment layer while the gatherer stabilizes. The gatherer will output normalized JSON/CSV/XLSX files, so MongoDB/Supabase can be added as an output target later without rebuilding the Backstage automation.
```

That is the correct technical stance.

---

# Final recommended architecture

```txt
InfiniView V3 Backstage Gatherer
│
├── Source:
│   └── Backstage browser automation
│
├── Processing:
│   ├── parse exports
│   ├── normalize values
│   ├── merge by Creator ID
│   └── apply manual enrichment
│
├── Outputs now:
│   ├── local raw files
│   ├── local combined CSV/XLSX/JSON
│   ├── Google Drive archive
│   └── Google Sheet latest master
│
└── Outputs later:
    ├── MongoDB
    ├── Supabase/Postgres
    ├── InfiniView API
    └── CRM sync
```

---

# First build target

The first version only needs to prove this:

```txt
One button runs the gatherer.
It downloads both Backstage exports.
It combines them by Creator ID.
It outputs combined-creators.xlsx, combined-creators.csv, and combined-creators.json.
It uploads them to Google Drive.
It updates the Latest Master Creators Google Sheet.
```

That is where you start.
