# Changelog

All notable changes to **InfiniView V3 Backstage Gatherer** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning follows `package.json` (`1.0.0` as of 2026-07-11 audit).

---

## [Unreleased]

### Documentation

- Complete documentation system rebuild (2026-07-11 audit):
  - Rewrote `README.md` with audit metadata, doc index, and honest status labels
  - Added `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`
  - Added `Documentation/` directory (18 reference docs + `AUDIT_2026-07-11.md`)
  - Preserved existing `docs/` and `Plan/HOW_TO_RUN.md`

### Added (code — prior commits on `main`, not yet version-tagged)

- Opt-in Auto Highlights scan client and hourly 8 AM–8 PM ET schedule hooks (`6d4c96b`) — **disabled by default**
- Daily snapshot history import pipeline and monthly goals repair tooling (`c5ce165`)
- Mongo snapshot deduplication improvements for large collections (`3857efc`)

---

## [1.0.0] — 2026-07-11 (documentation baseline)

Initial documented release baseline at commit `70496a5`.

### Implemented capabilities (evidence: source + successful `npm run build`)

- Playwright-based TikTok LIVE Backstage management and performance export
- Merge, normalize, filter, CRM/DIP enrichment pipeline
- Google Drive archive and Google Sheets master tab publish
- MongoDB dual-write to six collections in `InfiniViewV3`
- TikTok public Profile Acquirer (batch and per-user triggers)
- Express dashboard and manual trigger API on port 3099
- node-cron scheduling (fixed or randomized daily plans)
- Git auto-update watcher for two-PC dev/server workflow
- Nightly snapshot history import from Drive archives
- Optional Infinitum Server Agent post-publish hooks
- Optional failure email notifications via Gmail API
- Windows batch/PowerShell scripts for install, run, and reliability tasks

### CI

- GitHub Actions: `windows-latest`, Node 20, `npm ci` + `npm run build` (no tests)

---

## Historical note

Prior to this changelog, release history lived primarily in README bullets and Plan documents. Those sources may contain stale claims. Prefer this file and git history for change tracking going forward.

[Unreleased]: https://github.com/jrftw/InfiniViewV3BackstageDataGather/compare/70496a5...main
[1.0.0]: https://github.com/jrftw/InfiniViewV3BackstageDataGather/commit/70496a5
