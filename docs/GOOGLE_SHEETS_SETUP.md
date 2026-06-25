# Google Sheets Setup

1. Create a Google Cloud project.
2. Enable **Google Drive API** and **Google Sheets API**.
3. Create a **Service Account** and download the JSON key.
4. Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` in `.env`.
5. Copy `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` in `.env` (keep `\n` escapes).
6. Create a Google Drive folder: `InfiniView V3 Backstage Gatherer`.
7. Create a Google Sheet with these tabs (InfiniView V3 Master Data Sheet):
   - `01_Latest_Master_Creators`
   - `02_Backstage_Performance_Raw`
   - `03_Backstage_Management_Raw`
   - `04_Import_Log`
   - `05_Export_Errors`
   - `06_Unmatched_Rows`
   - `07_Change_Log`
   - `08_CRM_Link_Queue`
   - `09_Email_Phone_Enrichment` (never overwritten — you edit)
   - `10_Manager_Assignments` (never overwritten — you edit)
   - `11_Legacy_History` (never overwritten)
   - `Daily_YYYY-MM-DD` tabs are created automatically each day
8. Share **both** the folder and sheet with the service account email (Editor).
9. Copy folder ID and sheet ID into `.env`.

## Manual Enrichment tab headers

```
backstage_creator_id | tiktok_username | email | phone | crm_contact_id | preferred_manager | manual_notes | do_not_reassign | special_status | updated_by | updated_at
```

Tabs `09_Email_Phone_Enrichment`, `10_Manager_Assignments`, and `11_Legacy_History` are **never overwritten** by the gatherer.
