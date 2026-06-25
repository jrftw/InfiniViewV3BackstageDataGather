# InfiniView V3 — Gather, Database, CRM, InfiniView, and InfiniBoard Setup Guide

Updated: June 25, 2026
Project: InfiniView V3 / InfiniBoard / EspoCRM / Backstage Data

---

# MARK: The Simple Explanation

You are not building one giant spreadsheet.

You are building a system where each tool has one job.

Think of it like this:

```text
Backstage = TikTok creator performance data
CRM = creator relationship/contact history
Google Sheet = clean master import sheet / review sheet
Database = real app storage
InfiniView = app creators/managers see
InfiniBoard = staff/admin dashboard
Gather Tool = the thing that combines everything
```

The gather tool is the middle piece.

It takes data from Backstage, checks the CRM, updates the master sheet, then pushes clean data into the database for InfiniView and InfiniBoard.

---

# MARK: The Main Rule

Every creator must have one permanent ID.

The most important ID is:

```text
backstage_creator_id
```

That is the creator’s main identity.

The second most important ID is:

```text
crm_contact_id
```

That connects the creator to the CRM.

The third important ID is:

```text
portal_user_id
```

That connects the creator to InfiniView login access.

Do not use TikTok username as the main ID because usernames can change.

---

# MARK: The Big Data Flow

This is the full flow:

```text
Backstage Performance Export
        +
Backstage Management Export
        ↓
Gather Tool
        ↓
Clean and merge creator data
        ↓
Link each creator to CRM
        ↓
Write final clean row to Google Sheet
        ↓
Publish clean data to database
        ↓
InfiniView and InfiniBoard display the data
```

The CRM also connects into the gather tool:

```text
CRM
 ↓
Gather Tool pulls notes, contact info, risk status, manager info
 ↓
Master Sheet / Database get updated CRM fields
```

---

# MARK: What Backstage Is Responsible For

Backstage should be treated as the official source for creator performance.

Backstage owns these types of fields:

```text
backstage_creator_id
tiktok_username
joined_time
days_since_joining
graduation_status
relationship_status
subscription_status
invitation_type
new_live_creator_this_month
last_live
management_start_date
management_end_date
renewed_management_start_date
renewed_management_end_date
invited_by
agent_email
promote_permission
performance_data_period
total_diamonds
diamonds_l30d
dollars
live_duration_total_hours
valid_live_days_total
live_duration_l30d_hours
valid_live_days_l30d
followers
videos
likes
new_followers
live_streams
tier_status
tier_last_month
matches
diamonds_from_matches
fan_club_total_diamonds
fan_club data
multi_guest data
```

Managers should not manually edit these fields.

These come from Backstage imports.

---

# MARK: What the CRM Is Responsible For

The CRM should be the relationship system.

The CRM should own:

```text
crm_contact_id
email
phone
manager_name
director_name
preferred_manager
last_reviewed_at
last_contacted_at
risk_status
next_action_due_at
manual_notes
special_status
do_not_reassign
creator contact history
creator tasks
creator escalations
creator follow-ups
```

The CRM should not be your performance database.

The CRM should not be calculating diamonds, tiers, valid days, or hours.

---

# MARK: What Google Sheets Is Responsible For

Google Sheets should be the easy-to-see master import sheet.

It should show the final cleaned creator row after the gather process runs.

The main tab should be:

```text
creator_master
```

Optional support tabs:

```text
import_runs
sync_errors
crm_link_log
```

If you want to keep it simple, start with only:

```text
creator_master
```

The sheet is useful because you can look at it, sort it, filter it, and check if the data looks right.

But long term, InfiniView should not rely on Google Sheets as the main live database.

---

# MARK: What the Database Is Responsible For

The database is the real app storage.

This is what InfiniView and InfiniBoard should read from.

The database should store the cleaned version of the data from the gather tool.

The database should have tables like this:

```text
creators
creator_performance_snapshots
import_runs
crm_sync_logs
users
manager_assignments
announcements
creator_notes
creator_risk_reviews
audit_logs
```

---

# MARK: Database Table — creators

This is the main creator table.

It should store one row per creator.

Important fields:

```text
id
backstage_creator_id
crm_contact_id
portal_user_id
tiktok_username
normalized_username
display_name
email
phone
country
region
timezone
manager_name
director_name
relationship_status
subscription_status
risk_status
special_status
do_not_reassign
last_live
last_contacted_at
next_action_due_at
record_created_at
record_updated_at
last_successful_sync_at
last_sync_status
last_sync_error
```

This table is the main clean creator profile.

---

# MARK: Database Table — creator_performance_snapshots

This table stores performance history.

Instead of only storing the latest numbers, this lets you track changes over time.

Fields should include:

```text
id
backstage_creator_id
performance_data_period
total_diamonds
diamonds_l30d
dollars
live_duration_total_hours
valid_live_days_total
live_duration_l30d_hours
valid_live_days_l30d
followers
videos
likes
new_followers
live_streams
tier_status
tier_last_month
current_tier
progress_to_next_tier
matches
diamonds_from_matches
fan_club_total_diamonds
diamonds_from_fan_club_l30d
created_at
import_run_id
```

This lets InfiniView show charts later.

---

# MARK: Database Table — import_runs

Every time you run the gather tool, create one import run record.

Fields:

```text
id
import_run_id
started_at
completed_at
source_performance_file
source_management_file
total_rows_found
total_rows_imported
total_rows_failed
crm_matches_found
crm_contacts_created
sync_status
sync_error
created_by
```

This helps you know what happened during every import.

---

# MARK: Database Table — crm_sync_logs

This stores what happened when the gather tool checked the CRM.

Fields:

```text
id
import_run_id
backstage_creator_id
crm_contact_id
match_method
sync_status
sync_error
created_at
```

Example match methods:

```text
crm_contact_id
email
phone
normalized_username
created_new_contact
not_found
error
```

---

# MARK: Database Table — users

This is for app logins.

This table is for InfiniView and InfiniBoard users.

Fields:

```text
id
portal_user_id
crm_contact_id
backstage_creator_id
email
phone
role
login_enabled
last_login_at
created_at
updated_at
```

Roles can be:

```text
creator
manager
director
admin
owner
```

---

# MARK: Database Table — announcements

This is how InfiniBoard can post updates into InfiniView.

Fields:

```text
id
title
body
audience
created_by
created_at
expires_at
is_pinned
is_active
```

Audience examples:

```text
all_creators
all_managers
specific_manager_team
specific_creator
new_creators
at_risk_creators
```

---

# MARK: What the Gather Tool Does

The gather tool is the most important backend process.

It should do these steps in order.

---

## Step 1 — Read Backstage Files

You upload or provide:

```text
Backstage Performance Export
Backstage Management Export
```

The gather tool reads both files.

---

## Step 2 — Clean Basic Data

The gather tool cleans basic fields.

Examples:

```text
Lowercase emails
Clean phone numbers
Normalize TikTok usernames
Remove @ from usernames
Trim extra spaces
Convert dates into normal format
Convert numbers into real numbers
```

Example:

```text
@QueenWiDivyBz
```

becomes:

```text
queenwidivybz
```

---

## Step 3 — Merge Backstage Rows

The gather tool combines the performance export and management export.

It should match creators by:

```text
backstage_creator_id
```

If `backstage_creator_id` is missing, then it can try:

```text
normalized_username
email
phone
```

But the best match is always:

```text
backstage_creator_id
```

---

## Step 4 — Calculate Extra Fields

The gather tool calculates helpful fields.

Examples:

```text
current_tier
current_tier_index
last_month_tier_index
tier_rank_status
progress_to_next_tier
z_dip_status
streamer_diamond_bonus
maintained_bonus_eligible_80pct
risk_status
profile_completion_score
profile_needs_review
```

This is where the system decides things like:

```text
Creator maintained tier
Creator did not maintain tier
Creator is close to next tier
Creator is at risk
Creator needs review
```

---

## Step 5 — Link the Creator to CRM

After the Backstage row is clean, the gather tool checks the CRM.

The gather tool should look for the creator in this order:

```text
1. crm_contact_id
2. email
3. phone
4. normalized_username / TikTok username CRM field
5. create new CRM contact if no match exists
```

If it finds the creator in CRM, it saves the CRM ID into:

```text
crm_contact_id
```

If it does not find the creator, it creates a new CRM contact and then saves the new CRM ID.

---

## Step 6 — Pull CRM Fields Into the Creator Row

After the creator is linked to CRM, the gather tool pulls relationship fields.

CRM fields to pull:

```text
crm_contact_id
email
phone
manager_name
director_name
preferred_manager
last_reviewed_at
last_contacted_at
risk_status
next_action_due_at
manual_notes
special_status
do_not_reassign
portal_user_id
portal_login_enabled
last_portal_login_at
```

These fields then get added to the creator master row.

---

## Step 7 — Do Not Let CRM Overwrite Performance

The CRM should never overwrite these:

```text
diamonds
hours
valid days
followers
likes
videos
tier status
matches
fan club stats
last live
DIP status
performance period
```

Backstage owns those fields.

---

## Step 8 — Write to Google Sheet

The gather tool writes the final cleaned creator row to:

```text
creator_master
```

This row includes:

```text
Backstage data
CRM data
calculated fields
sync status
cache version
row checksum
```

---

## Step 9 — Publish to Database

After the sheet is updated, the gather tool pushes the clean data into the database.

InfiniView and InfiniBoard should read from the database.

They should not constantly read directly from the Google Sheet.

---

## Step 10 — Save Sync Status

Every row should have sync fields.

Important fields:

```text
schema_version
row_checksum
last_successful_sync_at
last_sync_status
last_sync_error
last_cache_published_at
cache_record_version
```

These tell you if the import worked or failed.

Example statuses:

```text
success
partial_success
crm_failed
database_failed
sheet_failed
error
```

---

# MARK: How InfiniView Should Link to the CRM

InfiniView should not directly connect to the CRM from the frontend.

That means the Flutter app should not contain the CRM API key.

The safe flow is:

```text
InfiniView Flutter App
        ↓
InfiniView Backend API
        ↓
Database
        ↓
CRM Service when needed
```

InfiniView should mostly read from the database.

When a creator or manager needs CRM-related info, the backend should handle it.

InfiniView can show:

```text
creator profile
diamonds
hours
valid days
tier progress
last live
manager assigned
risk status
next action due
announcements
training links
creator notes if allowed
```

If someone updates a note or action in InfiniView, the backend should decide whether it goes to:

```text
CRM
Database
Both
```

---

# MARK: How InfiniBoard Should Link to the CRM

InfiniBoard is the staff/admin side.

InfiniBoard should connect more deeply to the CRM than InfiniView.

InfiniBoard should allow staff to:

```text
view creator records
view manager assignments
view risk creators
create announcements
update follow-up status
submit weekly reviews
see import health
see CRM sync errors
open creator in CRM
```

InfiniBoard should still not expose the CRM API key.

The safe flow is:

```text
InfiniBoard
    ↓
Backend API
    ↓
Database
    ↓
CRM Service
```

When a manager updates a follow-up, InfiniBoard should update CRM and then update the database cache.

Example:

```text
Manager marks creator as contacted
        ↓
InfiniBoard sends update to backend
        ↓
Backend updates CRM contact
        ↓
Backend updates database creator row
        ↓
InfiniView/InfiniBoard show updated last_contacted_at
```

---

# MARK: What CRM Fields You Should Add

In EspoCRM, you should have fields for creator tracking.

Recommended CRM custom fields:

```text
backstageCreatorId
tiktokUsername
normalizedUsername
portalUserId
portalLoginEnabled
lastPortalLoginAt
preferredManager
directorName
riskStatus
nextActionDueAt
lastReviewedAt
lastContactedAt
specialStatus
doNotReassign
manualNotes
sourceNetwork
```

The CRM field names can be camelCase.

The sheet/database field names can stay snake_case.

Example:

```text
CRM: backstageCreatorId
Sheet: backstage_creator_id
Database: backstage_creator_id
```

That is fine.

---

# MARK: What Should Happen When a New Creator Appears

If a creator is in Backstage but not in CRM:

```text
Gather Tool sees new Backstage creator
        ↓
Searches CRM
        ↓
No CRM match found
        ↓
Creates new CRM contact
        ↓
Stores new CRM ID in crm_contact_id
        ↓
Adds creator to sheet
        ↓
Adds creator to database
        ↓
InfiniView can display creator
```

---

# MARK: What Should Happen When a Creator Already Exists

If the creator already has a CRM contact:

```text
Gather Tool reads creator row
        ↓
Sees crm_contact_id
        ↓
Fetches CRM contact
        ↓
Pulls CRM fields
        ↓
Updates sheet row
        ↓
Updates database row
```

---

# MARK: What Should Happen If CRM Is Down

The import should not fully fail just because CRM is down.

The gather tool should still import Backstage data.

It should mark the row like this:

```text
last_sync_status = crm_failed
last_sync_error = CRM unavailable
```

This way, creator performance still updates.

CRM fields can retry later.

---

# MARK: What Should Happen If Google Sheets Fails

If the database works but Google Sheets fails, the system should say:

```text
last_sync_status = sheet_failed
```

The app can still work from the database.

---

# MARK: What Should Happen If Database Fails

If the database fails, the sheet can still be updated.

The row should show:

```text
last_sync_status = database_failed
```

Then you know the app may not show the newest data yet.

---

# MARK: What InfiniView Should Display

InfiniView should be the clean creator/manager portal.

Creator profile should show:

```text
TikTok username
display name
profile image
followers
likes
videos
diamonds this month
total diamonds
valid days this month
hours this month
tier status
progress to next tier
last live
manager name
important announcements
training links
goals
risk/help status if appropriate
```

Manager view should show:

```text
assigned creators
active creators
inactive creators
at-risk creators
creators close to tier
creators needing follow-up
recent notes
next actions
```

---

# MARK: What InfiniBoard Should Display

InfiniBoard should be the admin/staff system.

It should show:

```text
network-wide creator stats
manager performance
director performance
import health
CRM sync health
at-risk creators
announcements
weekly manager reviews
creator reassignment tools
creator notes
manager task tracking
```

InfiniBoard is where leadership manages the network.

InfiniView is where creators/managers view useful info.

---

# MARK: What Managers Should Edit

Managers should be allowed to edit CRM-style fields only.

Managers can edit:

```text
last_contacted_at
next_action_due_at
risk_status
manual_notes
creator notes
follow-up status
weekly review info
```

Managers should not edit:

```text
diamonds
hours
valid days
tier status
followers
likes
Backstage creator ID
import run ID
row checksum
sync status
```

---

# MARK: What Admins Should Edit

Admins can edit:

```text
manager assignment
director assignment
special_status
do_not_reassign
portal access
announcement visibility
manual overrides
```

But even admins should avoid manually editing Backstage performance numbers.

---

# MARK: First Version Setup

Do not build everything at once.

Start with this version:

```text
1. Backstage import files
2. Gather tool
3. One master Google Sheet tab
4. CRM contact linking
5. Database sync
6. Basic InfiniView creator profile
7. Basic InfiniBoard admin dashboard
```

Do not start with every advanced feature.

Get the core pipeline working first.

---

# MARK: Best Build Order

Build in this exact order:

## Phase 1 — Lock the Master Sheet

Create the final `creator_master` tab.

Keep your current fields.

Make sure every row has:

```text
backstage_creator_id
tiktok_username
normalized_username
crm_contact_id
import_run_id
schema_version
row_checksum
last_successful_sync_at
last_sync_status
last_sync_error
```

---

## Phase 2 — Prepare the CRM

In EspoCRM:

```text
Create creator custom fields
Create API user
Give API user limited permissions
Make sure Contacts can store backstageCreatorId and tiktokUsername
```

The CRM should be ready before the gather tool tries to sync.

---

## Phase 3 — Build the Gather Tool

The gather tool should:

```text
Read Backstage files
Clean data
Merge rows
Calculate extra fields
Search CRM
Create CRM contacts if needed
Write to Google Sheet
Write to database
Log errors
```

---

## Phase 4 — Add the Database

Create the database tables:

```text
creators
creator_performance_snapshots
import_runs
crm_sync_logs
users
announcements
audit_logs
```

At first, keep the database simple.

Do not overbuild it.

---

## Phase 5 — Connect InfiniView

InfiniView should read from the database.

It should show creator profiles and performance.

It should not talk directly to Google Sheets or CRM.

---

## Phase 6 — Connect InfiniBoard

InfiniBoard should read from the database.

It can update CRM through the backend.

It should manage:

```text
staff tools
manager reviews
creator notes
announcements
risk tracking
sync health
```

---

## Phase 7 — Add Automation Later

After the basics work, then add:

```text
automatic imports
automatic CRM retries
automatic risk alerts
automatic manager reminders
automatic creator summaries
creator profile scanning
video/profile improvement suggestions
```

Do this later, not first.

---

# MARK: The Final System Map

This is the final clean system:

```text
Backstage
   ↓
Gather Tool
   ↓
Google Sheet
   ↓
Database
   ↓
InfiniView
   ↓
Creators / Managers
```

CRM connects like this:

```text
CRM
 ↕
Gather Tool
 ↕
Database
 ↕
InfiniBoard
```

InfiniBoard can update CRM.

InfiniView mostly reads clean data.

---

# MARK: What Not To Do

Do not do these:

```text
Do not put the CRM API key inside Flutter
Do not put the CRM API key in frontend code
Do not use TikTok username as the permanent creator ID
Do not make managers edit performance numbers
Do not make CRM the main performance database
Do not make Google Sheets the long-term live app database
Do not build every feature before the import pipeline works
Do not create ten different sources of truth
```

---

# MARK: The Correct Source of Truth

Use this:

```text
Backstage = official performance truth
CRM = official relationship/contact truth
Database = official app truth
Google Sheet = human-readable import/cache view
InfiniView = display portal
InfiniBoard = staff/admin control center
```

---

# MARK: Daily Workflow

Your daily workflow should eventually be:

```text
1. Export Backstage files
2. Upload them into Gather Tool
3. Gather Tool runs
4. Check import summary
5. Fix any failed CRM matches
6. InfiniView updates automatically
7. InfiniBoard shows latest staff/admin view
```

---

# MARK: Weekly Workflow

Weekly:

```text
Review at-risk creators
Review CRM sync errors
Review manager follow-ups
Review missing emails/phones
Review do-not-reassign creators
Review inactive creators
Review import health
```

---

# MARK: The Easiest Way To Think About It

Backstage tells you:

```text
How is the creator performing?
```

CRM tells you:

```text
What is happening with this creator relationship?
```

Database tells the app:

```text
What should InfiniView and InfiniBoard show?
```

Gather tool says:

```text
Let me combine all of this cleanly.
```

---

# MARK: Cursor / Developer Build Prompt

Use this as the build instruction:

```text
Build the InfiniView V3 gather pipeline.

The system must import Backstage performance and management exports, clean the data, merge creator rows by backstage_creator_id, enrich each creator with EspoCRM contact data, write the final row to a Google Sheet creator_master tab, and publish the cleaned records to the application database.

Backstage is the source of truth for performance data.
EspoCRM is the source of truth for contact, relationship, notes, risk, and follow-up fields.
The database is the source of truth for InfiniView and InfiniBoard app display.
Google Sheets is a human-readable master/cache sheet.

Do not expose CRM API keys to Flutter, frontend code, or public scripts.
All CRM access must happen through the backend gather service or backend API.

Creator matching priority:
1. backstage_creator_id
2. crm_contact_id
3. email
4. phone
5. normalized_username
6. create new CRM contact if no match exists

Required system parts:
1. Backstage file reader
2. Data cleaner/normalizer
3. Creator row merger
4. Tier/progress/status calculator
5. EspoCRM service
6. Google Sheets writer
7. Database publisher
8. Import run logger
9. CRM sync logger
10. Error handling that allows partial success

The gather process must not crash the entire import if CRM fails.
If CRM fails, still import Backstage data and mark last_sync_status as crm_failed.

The app should read from the database, not directly from Google Sheets.
InfiniView should display creator/manager data.
InfiniBoard should handle staff/admin tools and CRM-linked workflow actions.
```

---

# MARK: Final Plain-English Answer

Yes, you should link the CRM.

But the CRM should not run everything.

The correct setup is:

```text
Backstage gives performance data.
Gather tool cleans and combines the data.
CRM adds contact and relationship data.
Google Sheet shows the clean master row.
Database stores the real app data.
InfiniView displays creator/manager info.
InfiniBoard manages staff/admin/CRM workflows.
```

Build it in that order.

Do not try to build the whole final dream version first.

Get the gather pipeline working first.

Once the gather pipeline works, everything else becomes easier.
