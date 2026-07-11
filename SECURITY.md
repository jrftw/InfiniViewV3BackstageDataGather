# Security Policy

**Project:** InfiniView V3 Backstage Gatherer  
**Owner:** Infinitum Imagery LLC  
**Last updated:** 2026-07-11

---

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.0.x (current `main`) | Yes |
| Older undocumented builds | No |

Security fixes are applied to the `main` branch of [InfiniViewV3BackstageDataGather](https://github.com/jrftw/InfiniViewV3BackstageDataGather).

---

## Reporting a vulnerability

**Do not open public GitHub issues for security vulnerabilities.**

Report privately to the repository owner through your established Infinitum Imagery LLC channel (direct message or private email on file with the team).

Include:

- Description of the issue and impact
- Steps to reproduce
- Affected files, routes, or configuration
- Whether production credentials are required to exploit

Response timing depends on severity and availability; no fixed SLA is guaranteed.

---

## Sensitive assets in this project

| Asset | Location | Risk if exposed |
|-------|----------|-----------------|
| Backstage credentials | `.env` (`BACKSTAGE_EMAIL`, `BACKSTAGE_PASSWORD`) | Agency account compromise |
| Backstage session | `data/auth/backstage-auth.json` | Unauthorized Backstage access |
| Google service account key | `.env` (`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`) | Drive/Sheets/Gmail access |
| MongoDB URI | `.env` (`MONGODB_URI`) | Database read/write |
| InfiniView internal secret | `.env` (`INFINIVIEW_INTERNAL_SERVICE_SECRET`) | Internal API route access |
| Infinitum Agent token | `.env` (`INFINITUM_AGENT_API_TOKEN`) | LAN agent API access |

All of the above are **gitignored** or must never be committed.

---

## Secret handling rules

1. Use `.env.example` with empty placeholders only
2. Never log passwords, private keys, bearer tokens, or full connection strings
3. Share Google Drive folders and Sheets with the service account email — not by exporting keys into chat
4. Rotate Backstage session by re-running `npm run login` after credential changes
5. Treat the Express dashboard as **trusted LAN only** — it has no built-in auth

---

## Known security limitations

Documented in [Documentation/SECURITY_MODEL.md](Documentation/SECURITY_MODEL.md):

- Dashboard and `/run-now` endpoints have **no authentication**
- Manual trigger API accepts requests from any client that can reach port 3099
- Failure email and Google publish depend on domain-wide delegation configuration
- Playwright runs with saved session cookies on the server filesystem

These are architectural choices for a single-tenant server PC, not oversights suitable for public internet exposure without a reverse proxy and auth layer.

---

## Dependency reporting

Run `npm audit` periodically on the server PC. CI does not currently run security audits automatically.

Report critical advisories affecting Playwright, Express, MongoDB driver, or googleapis through the private channel above.

---

## What not to post publicly

- Production `.env` contents
- `backstage-auth.json` or session exports
- Internal IP addresses combined with API tokens
- MongoDB connection strings
- Real creator PII from exports or sheets

---

## Data exposure procedures

If credentials are accidentally committed:

1. Revoke/rotate the exposed credential immediately (Google key, MongoDB user, Backstage password)
2. Remove from git history only with owner approval (prefer rotation over force-push when possible)
3. Re-run `npm run login` on affected server PCs
4. Document the incident in the private ops log
