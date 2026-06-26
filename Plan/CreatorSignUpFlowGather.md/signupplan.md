MARK: Keep This One Sheet

Do not rebuild the field list right now.

Do not start InfiniView V3 first.

Do not split this into 10 tabs.

This sheet is your current creator_master table.

MARK: What You Need To Build Next

You need to add one new job to your gatherer:

tiktok_public_profile_gatherer

That job should look at this field:

normalized_username

Then fill only this section:

profile_image_url
profile_image_source
profile_image_original_url
profile_image_hash
profile_image_last_checked_at
profile_image_last_changed_at

tiktok_profile_url
creator_bio
bio_link_url
website_url
public_following
public_followers_snapshot
public_likes_snapshot
public_video_count_snapshot

profile_snapshot_source
profile_snapshot_last_checked_at
profile_snapshot_last_changed_at
profile_snapshot_status
profile_snapshot_error
profile_last_known_good_at
profile_completion_score
profile_needs_review

top_video_1_*
top_video_2_*
top_video_3_*

recent_video_1_*
recent_video_2_*
recent_video_3_*
recent_video_4_*
recent_video_5_*
recent_video_6_*

It should not touch:

total_diamonds
diamonds_l30d
dollars
live_duration_total_hours
valid_live_days_total
tier_status
manager_name
director_name
notes
manual_notes
import_run_id
source_performance_file
source_management_file

Those belong to Backstage/imports/staff.

MARK: Source Of Truth
Field Group	Filled By
backstage_creator_id, joined_time, diamonds, tier_status, fan_club, matches	Backstage import
email, phone, crm_contact_id, manager_name, director_name	CRM / Backstage / staff
portal_user_id, portal_login_enabled, last_portal_login_at	InfiniView account system
profile_image_*, creator_bio, bio_link_url, public_followers_snapshot, recent_video_*	New TikTok profile gatherer
profile_completion_score, profile_needs_review	Your system calculates
row_checksum, last_successful_sync_at, last_sync_status	Gatherer/import system
MARK: Why You Have Duplicate-Looking Fields

You have these:

followers
videos
likes

And also:

public_followers_snapshot
public_video_count_snapshot
public_likes_snapshot

Keep both.

They are not the same thing.

followers / videos / likes

come from Backstage.

public_followers_snapshot / public_video_count_snapshot / public_likes_snapshot

come from the public TikTok profile gatherer.

That way, later you can compare:

Backstage follower count vs public TikTok follower count
Backstage video count vs public TikTok video count
Backstage likes vs public TikTok likes
MARK: What Happens With Your Current Rows

For this row:

queenwidivybz

You already have:

backstage_creator_id = 7359135855103475718
tiktok_username = queenwidivybz
normalized_username = queenwidivybz
email = iamqueenhenry@gmail.com
phone = 9177449394
country = us_ca
total_diamonds = 4147379
diamonds_l30d = 4238048
followers = 428623
videos = 659
likes = 946800

That means Backstage import is working.

The gatherer now needs to fill:

tiktok_profile_url = https://www.tiktok.com/@queenwidivybz
profile_snapshot_source = tiktok_public_snapshot
profile_snapshot_status = ok / error / manual_review
profile_snapshot_last_checked_at = current timestamp
profile_image_*
creator_bio
public_followers_snapshot
public_likes_snapshot
public_video_count_snapshot
recent_video_1 through recent_video_6
MARK: Exact Gatherer Flow
Start with each creator row
↓
Check normalized_username
↓
If missing, skip and mark profile_needs_review = TRUE
↓
Build tiktok_profile_url
↓
Gather public TikTok profile data
↓
Gather avatar/profile image
↓
Hash profile image
↓
Compare new hash to old hash
↓
Update profile_image_last_checked_at
↓
Update profile_image_last_changed_at only if changed
↓
Gather bio/link/public counts
↓
Gather recent video URLs
↓
Use TikTok embed/oEmbed data for known video URLs
↓
Calculate profile_completion_score
↓
Set profile_needs_review
↓
Save row

TikTok’s official Display API can provide profile/video data, but it requires authorization and proper scopes; the /v2/video/list/ endpoint is for authorized public video posts and requires the video.list scope. TikTok’s oEmbed/embed tools are useful after you already have a profile or video URL, especially for turning known TikTok URLs into embed data.

MARK: Status Rules

When the gatherer starts:

profile_snapshot_status = pending
profile_snapshot_source = tiktok_public_snapshot
profile_snapshot_error = blank

If it works:

profile_snapshot_status = ok
profile_snapshot_error = blank
profile_last_known_good_at = now
profile_snapshot_last_checked_at = now

If profile does not exist:

profile_snapshot_status = not_found
profile_snapshot_error = TikTok profile not found
profile_needs_review = TRUE

If TikTok blocks or fails:

profile_snapshot_status = blocked
profile_snapshot_error = TikTok public profile snapshot blocked or unavailable
profile_needs_review = TRUE

If profile is usable but missing important stuff:

profile_snapshot_status = manual_review
profile_needs_review = TRUE
MARK: What To Build Before InfiniView V3

Build this first:

1. Update your gatherer to read normalized_username
2. Add TikTok public profile snapshot job
3. Update only the blank TikTok profile fields
4. Save status/error/review fields
5. Then build InfiniView V3 to display those saved fields

InfiniView V3 does not collect this data.

InfiniView V3 only reads:

profile_image_url
creator_bio
bio_link_url
public_followers_snapshot
public_likes_snapshot
public_video_count_snapshot
recent_video_1_embed_url
recent_video_2_embed_url
recent_video_3_embed_url
profile_snapshot_status
profile_needs_review
MARK: Simple Answer

Your current sheet is fine.

You do not need more fields right now.

You do not need to start InfiniView V3 first.

You need to add this to the existing gatherer:

For every creator with a normalized_username:
  gather public TikTok profile info
  fill the blank profile fields
  mark status
  mark review if needed
  never overwrite Backstage performance data

That’s it.

Yes. Add this as the **next phase after your Backstage Acquire step**.

TikTok official APIs require user authorization/scopes for true account-connected profile/video access, but TikTok oEmbed can help once you already have a TikTok profile or video URL. So your first version should be a **public profile snapshot acquirer**, with optional official TikTok Login Kit later. ([TikTok Developers][1])

Paste this into your plan:

# MARK: Phase 2 — TikTok Public Profile Acquirer

## Purpose

After the Backstage Acquire process imports creator performance and management data, the TikTok Public Profile Acquirer runs next to fill the public-facing profile fields needed for InfiniView V3.

Backstage Acquire fills agency/performance fields.

TikTok Public Profile Acquirer fills profile image, bio, public profile counts, profile links, and recent video embed fields.

InfiniView V3 only displays the saved data. It does not scrape or gather TikTok data directly.

---

# MARK: Run Order

1. Backstage Acquire runs first.
2. Backstage data is merged into the creator master table.
3. The system checks each row for `normalized_username`.
4. If `normalized_username` exists, the TikTok Public Profile Acquirer runs.
5. The acquirer builds the public TikTok profile URL.
6. The acquirer attempts to collect public profile data.
7. The acquirer fills only TikTok public profile fields.
8. The acquirer calculates profile completion score.
9. The acquirer sets review/status flags.
10. The creator row is saved for InfiniView V3.

---

# MARK: Trigger Rule

The TikTok Public Profile Acquirer should run when:

* A creator is newly imported from Backstage
* A creator creates an InfiniView account
* A creator updates their TikTok username
* A staff member manually requests refresh
* A scheduled refresh runs daily or weekly

---

# MARK: Input Fields Used

The acquirer should read these fields:

```text
backstage_creator_id
tiktok_username
normalized_username
display_name
email
phone
```

The main required field is:

```text
normalized_username
```

If `normalized_username` is blank, the acquirer should skip the creator and mark the profile as needing review.

---

# MARK: Profile URL Builder

For each creator, build:

```text
tiktok_profile_url = https://www.tiktok.com/@{normalized_username}
```

Example:

```text
normalized_username = queenwidivybz
tiktok_profile_url = https://www.tiktok.com/@queenwidivybz
```

---

# MARK: Fields Filled By TikTok Public Profile Acquirer

The acquirer should fill this section only:

```text
profile_image_url
profile_image_source
profile_image_original_url
profile_image_hash
profile_image_last_checked_at
profile_image_last_changed_at

tiktok_profile_url
creator_bio
bio_link_url
website_url
public_following
public_followers_snapshot
public_likes_snapshot
public_video_count_snapshot

profile_snapshot_source
profile_snapshot_last_checked_at
profile_snapshot_last_changed_at
profile_snapshot_status
profile_snapshot_error
profile_last_known_good_at
profile_completion_score
profile_needs_review

top_video_1_url
top_video_1_embed_url
top_video_1_id
top_video_1_source
top_video_1_status
top_video_1_last_checked_at

top_video_2_url
top_video_2_embed_url
top_video_2_id
top_video_2_source
top_video_2_status
top_video_2_last_checked_at

top_video_3_url
top_video_3_embed_url
top_video_3_id
top_video_3_source
top_video_3_status
top_video_3_last_checked_at

recent_video_1_url
recent_video_1_embed_url
recent_video_1_id
recent_video_1_source
recent_video_1_status
recent_video_1_last_checked_at

recent_video_2_url
recent_video_2_embed_url
recent_video_2_id
recent_video_2_source
recent_video_2_status
recent_video_2_last_checked_at

recent_video_3_url
recent_video_3_embed_url
recent_video_3_id
recent_video_3_source
recent_video_3_status
recent_video_3_last_checked_at

recent_video_4_url
recent_video_4_embed_url
recent_video_4_id
recent_video_4_source
recent_video_4_status
recent_video_4_last_checked_at

recent_video_5_url
recent_video_5_embed_url
recent_video_5_id
recent_video_5_source
recent_video_5_status
recent_video_5_last_checked_at

recent_video_6_url
recent_video_6_embed_url
recent_video_6_id
recent_video_6_source
recent_video_6_status
recent_video_6_last_checked_at
```

---

# MARK: Fields The Acquirer Must Not Touch

The TikTok Public Profile Acquirer must not overwrite Backstage performance, management, CRM, or staff fields.

Do not touch:

```text
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
manager_name
director_name
notes
manual_notes
special_status
do_not_reassign
warnings
import_run_id
imported_at
source_performance_file
source_management_file
match_method
```

---

# MARK: Source Values

Use these source values:

```text
tiktok_public_snapshot
tiktok_oembed
tiktok_display_api
manual
unavailable
```

For the first version, most fields should use:

```text
tiktok_public_snapshot
```

For video embed fields, use:

```text
tiktok_oembed
```

---

# MARK: Status Values

Use these status values:

```text
pending
ok
not_found
private_or_unavailable
blocked
rate_limited
error
manual_review
unavailable
```

---

# MARK: Acquirer Flow

```text
Start TikTok Public Profile Acquirer
↓
Load creator rows from creator_master
↓
Find rows with normalized_username
↓
Build TikTok profile URL
↓
Set profile_snapshot_status = pending
↓
Attempt public profile snapshot
↓
If profile exists, collect profile image, bio, profile link, public counts, and recent videos
↓
If video URLs are found, request embed data for each known video URL
↓
Download/cache profile image
↓
Hash profile image
↓
Compare new image hash to old image hash
↓
Update profile_image_last_checked_at
↓
Update profile_image_last_changed_at only if hash changed
↓
Update profile_snapshot_last_checked_at
↓
Update profile_snapshot_last_changed_at only if profile data changed
↓
Calculate profile_completion_score
↓
Set profile_needs_review true or false
↓
Save creator row
```

---

# MARK: Profile Image Rules

If a profile image is found:

```text
profile_image_original_url = original TikTok image URL
profile_image_url = cached InfiniView image URL
profile_image_source = tiktok_public_snapshot
profile_image_hash = image hash
profile_image_last_checked_at = current timestamp
```

If the new image hash is different from the old image hash:

```text
profile_image_last_changed_at = current timestamp
```

If the image did not change:

```text
profile_image_last_changed_at = keep old value
```

---

# MARK: Profile Snapshot Rules

If the profile is collected successfully:

```text
profile_snapshot_status = ok
profile_snapshot_source = tiktok_public_snapshot
profile_snapshot_error = blank
profile_snapshot_last_checked_at = current timestamp
profile_last_known_good_at = current timestamp
```

If the profile does not exist:

```text
profile_snapshot_status = not_found
profile_snapshot_error = TikTok profile not found
profile_needs_review = TRUE
```

If TikTok blocks or data cannot be collected:

```text
profile_snapshot_status = blocked
profile_snapshot_error = TikTok public profile snapshot blocked or unavailable
profile_needs_review = TRUE
```

If important fields are missing:

```text
profile_snapshot_status = manual_review
profile_needs_review = TRUE
```

---

# MARK: Recent Video Rules

The acquirer should try to fill the 6 most recent public videos:

```text
recent_video_1 = newest public video
recent_video_2 = second newest public video
recent_video_3 = third newest public video
recent_video_4 = fourth newest public video
recent_video_5 = fifth newest public video
recent_video_6 = sixth newest public video
```

Each recent video should save:

```text
recent_video_X_url
recent_video_X_embed_url
recent_video_X_id
recent_video_X_source
recent_video_X_status
recent_video_X_last_checked_at
```

If a video is found:

```text
recent_video_X_status = ok
recent_video_X_source = tiktok_oembed
```

If no video is found:

```text
recent_video_X_status = unavailable
recent_video_X_source = unavailable
```

---

# MARK: Top Video Rules

Top videos should only be filled if the acquirer can confidently detect public video performance metrics.

If top videos cannot be confidently detected:

```text
top_video_1_status = unavailable
top_video_2_status = unavailable
top_video_3_status = unavailable
```

Do not fake top videos by copying recent videos unless the system clearly labels them as recent videos.

---

# MARK: Profile Completion Score

Calculate `profile_completion_score` out of 100.

Recommended scoring:

```text
20 points = has profile image
20 points = has creator bio
15 points = has bio link or website
15 points = has public follower count
15 points = has public video count
15 points = has at least 3 recent videos
```

If score is below 60:

```text
profile_needs_review = TRUE
```

If score is 60 or higher and snapshot status is ok:

```text
profile_needs_review = FALSE
```

---

# MARK: Refresh Schedule

Run the TikTok Public Profile Acquirer:

```text
New creator: immediately after Backstage Acquire
Existing creators: once every 24 hours or once every 7 days
Manual refresh: available to staff
Failed profiles: retry later with rate limits
```

Recommended first version:

```text
Refresh active creators daily
Refresh inactive creators weekly
Refresh failed creators once per day
```

---

# MARK: InfiniView V3 Dependency

InfiniView V3 should not be started until this acquirer is at least partially working.

InfiniView V3 will read these saved fields:

```text
profile_image_url
creator_bio
bio_link_url
public_followers_snapshot
public_likes_snapshot
public_video_count_snapshot
recent_video_1_embed_url
recent_video_2_embed_url
recent_video_3_embed_url
profile_snapshot_status
profile_needs_review
```

---

# MARK: Final Phase 2 Goal

The goal of this phase is:

```text
Backstage tells us how the creator is performing.
TikTok Public Profile Acquirer tells us what the creator profile looks like publicly.
InfiniView V3 combines both into one clean creator profile.
```

Your build order should now be:

```text
Phase 1: Backstage Acquire
Phase 2: TikTok Public Profile Acquirer
Phase 3: CRM Link/Enrichment
Phase 4: Publish clean cache/table
Phase 5: InfiniView V3 app reads the finished data
```

The key thing: **the acquirer starts from `normalized_username`**, not from InfiniView. InfiniView comes later.

[1]: https://developers.tiktok.com/doc/display-api-get-started/?utm_source=chatgpt.com "Guide to Using TikTok Display APIs"

---

# MARK: Separate Job Architecture (Implemented)

Phase 2 is a **separate job** from Backstage gather. Scheduled Backstage runs do **not** run the profile acquirer unless you opt in.

## Run order

```text
Phase 1: Backstage Acquire (npm run gather / scheduled / dashboard "Run Backstage Gatherer")
         ↓
         merges performance + CRM/DIP into 01_Latest_Master_Creators
         ↓
         preserves existing TikTok profile fields already on the master sheet

Phase 2: TikTok Public Profile Acquirer (manual / signup / optional chain)
         ↓
         reads master sheet → fills profile_* fields only → writes master sheet back
```

## How to run Phase 2

| Trigger | Command |
|---|---|
| Manual batch (stale creators) | `npm run profile-acquire` or `run-profile-acquirer.bat` |
| Single creator (signup / username change) | `npm run profile-acquire -- --username=queenwidivybz` |
| Dashboard | http://localhost:3099 → **Run Profile Acquirer** |
| API — batch | `POST http://localhost:3099/run-profile-acquirer` |
| API — one creator | `POST http://localhost:3099/run-profile-acquirer` body `{ "normalized_username": "queenwidivybz" }` |
| API — GET shortcut | `GET http://localhost:3099/run-profile-acquirer?username=queenwidivybz` |

## Optional chain after Backstage

Only if you set in `.env`:

```text
GATHERER_PROFILE_ACQUIRER_AFTER_BACKSTAGE=true
GATHERER_PROFILE_ACQUIRER_AFTER_BACKSTAGE_NEW_ONLY=true
```

Then a successful Backstage gather automatically runs the profile acquirer for **new** creators only (no prior `profile_snapshot_last_checked_at`).

Default is **off** — profile acquirer never runs on the 10x/day Backstage schedule unless you turn this on.

## InfiniView signup hook (later)

When a creator signs up or changes TikTok username, InfiniView backend should call:

```text
POST /run-profile-acquirer
{ "normalized_username": "theirusername" }
```

That runs Phase 2 for one row without running Backstage.

## Profile images on Google Drive (app-ready URLs)

Profile avatars upload to:

```text
GOOGLE_DRIVE_PROFILE_IMAGES_FOLDER_ID=1ToI_sz_iqEcquveHSM3worJdt_v65I_W
```

Folder: [InfiniView creator profile images](https://drive.google.com/drive/folders/1ToI_sz_iqEcquveHSM3worJdt_v65I_W?usp=sharing)

- Share that folder with your **Google service account email** (Editor).
- Each run upserts `{normalized_username}.jpg` (small/medium avatar).
- `profile_image_url` becomes an HTTPS view URL the app can load:
  `https://drive.google.com/uc?export=view&id=FILE_ID`
- `profile_image_source` = `google_drive` when uploaded successfully.
- `profile_image_original_url` keeps the TikTok CDN source URL.

## Recent videos (browser fetch)

When TikTok's HTML has no video list, the acquirer launches headless Chromium, scrolls the profile grid, and collects recent video IDs + oEmbed URLs.

Disable with `GATHERER_PROFILE_ACQUIRER_BROWSER_VIDEOS=false` if you only want bio/avatar/counts.

## What Backstage runs must never do

Backstage gather must not scrape TikTok public profiles on every run.

Backstage gather **does** preserve profile acquirer fields already saved on the master sheet so scheduled imports do not wipe bios, avatars, or recent videos.

