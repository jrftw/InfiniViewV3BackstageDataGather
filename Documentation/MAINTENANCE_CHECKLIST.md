# Maintenance Checklist — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## Every pull request

- [ ] `npm run build` passes
- [ ] No secrets in diff
- [ ] CHANGELOG `[Unreleased]` updated
- [ ] API/env changes reflected in `Documentation/API_REFERENCE.md` and `CONFIGURATION_REFERENCE.md`
- [ ] Backstage selector changes documented in `docs/BACKSTAGE_EXPORT_STEPS.md`
- [ ] Visible gather tested if touching `src/backstage/` (when credentials available)

---

## Every release (version bump in `package.json`)

- [ ] Move CHANGELOG items from Unreleased to version section with date
- [ ] Tag commit in GitHub (owner action)
- [ ] Verify server PC auto-update pulls tag/commit
- [ ] Run manual gather on server after deploy
- [ ] Verify `/api/status` shows success
- [ ] Confirm MongoDB `gatherer_import_runs` latest entry

---

## Every deployment (server PC)

- [ ] `install-server.bat` or `npm ci && npm run build` on server
- [ ] `.env` reviewed for new variables from `.env.example`
- [ ] `npm run preflight` passes
- [ ] `start-server.bat` or scheduled task running
- [ ] Watchdog task enabled (`setup-server-reliability.bat`)
- [ ] Windows sleep disabled
- [ ] Port 3099 reachable on LAN only

---

## Monthly documentation audit

- [ ] Compare README version to `package.json`
- [ ] Re-run `npm run build` and record exit code
- [ ] Review git log for undocumented features
- [ ] Update `Documentation/FEATURE_INVENTORY.md` statuses
- [ ] Check Backstage UI for selector drift (visible gather)
- [ ] Verify CI workflow still matches BUILD_AND_DEPLOYMENT.md
- [ ] Create new `Documentation/AUDIT_YYYY-MM-DD.md` if material changes

---

## Dependency update

- [ ] Run `npm outdated` on dev PC
- [ ] Update one major dependency at a time (especially Playwright)
- [ ] `npm run build`
- [ ] `npx playwright install chromium` after Playwright bump
- [ ] Visible gather regression test
- [ ] Run `npm audit` — triage critical findings
- [ ] Push during low-traffic window; monitor server auto-update

---

## Security-sensitive changes

- [ ] Rotate affected secrets (Google key, Mongo user, internal API secret)
- [ ] Update `.env` on server PC securely
- [ ] Re-run `npm run login` if Backstage credentials changed
- [ ] Review `Documentation/SECURITY_MODEL.md`
- [ ] Never commit `.env` or auth JSON

---

## API contract change (Express or consumed InfiniView API)

- [ ] Update `Documentation/API_REFERENCE.md`
- [ ] Notify InfiniView API team if highlight scan payload changes
- [ ] Coordinate Profile Acquirer trigger URLs with Unified App if changed

---

## Database / Mongo migration

- [ ] Update `gathererMongoIndexBootstrap.ts` if indexes change
- [ ] Test on non-production Mongo user first if available
- [ ] Run snapshot verify job after history engine changes
- [ ] Document in CHANGELOG

---

## Feature deprecation

- [ ] Mark status in `FEATURE_INVENTORY.md`
- [ ] Add entry to `DEPRECATIONS_AND_LEGACY.md`
- [ ] Keep env flag default-safe for one release cycle
- [ ] Remove only after server `.env` confirmed clear

---

## Backstage UI change (TikTok update)

- [ ] Run visible gather to capture new flow
- [ ] Update `backstageSelectors.ts`
- [ ] Update `docs/BACKSTAGE_EXPORT_STEPS.md`
- [ ] Deploy urgently — scheduled runs fail until fixed

---

## Disaster recovery

- [ ] Server PC hardware failure: restore from git clone + backup `.env` + `backstage-auth.json`
- [ ] MongoDB restore: out of scope for gatherer — follow Atlas backup procedures
- [ ] Google sheet corruption: restore from Drive daily archives
