# Security Model — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11

---

## Trust boundaries

```text
[Internet]
    ├── TikTok Backstage ← Playwright (agency session)
    ├── TikTok public web ← Profile Acquirer
    ├── Google APIs ← service account (+ optional delegation)
    ├── MongoDB Atlas ← connection string
    └── InfiniView Cloud Function ← bearer secret (opt-in)

[Office LAN]
    ├── Express :3099 ← UNAUTHENTICATED manual triggers
    └── Infinitum Agent ← optional token (LAN)

[Server filesystem]
    ├── .env (secrets)
    └── data/auth/backstage-auth.json (session cookies)
```

---

## Authentication summary

| Surface | Mechanism | Enforced where |
|---------|-----------|----------------|
| Express API | None | N/A — trust network |
| Backstage | Saved Playwright session + optional password | TikTok |
| Google | Service account JWT | Google OAuth |
| MongoDB | Connection string credentials | Atlas |
| InfiniView internal API | Bearer `INFINIVIEW_INTERNAL_SERVICE_SECRET` | InfiniView API server |
| Infinitum Agent | `INFINITUM_AGENT_API_TOKEN` | Agent server |

---

## Authorization

No RBAC in gatherer code. Single agency operator model.

InfiniView API enforces its own authorization on `/internal/community/highlights/scan` — gatherer only supplies the shared secret.

---

## Data isolation

- One agency's Backstage data per server PC deployment
- MongoDB database name configurable but typically shared `InfiniViewV3` with InfiniView API
- No per-creator access control inside gatherer — all exported creators processed together

---

## Secrets handling

| Secret | Storage | In logs? |
|--------|---------|----------|
| Backstage password | `.env` | Must not appear |
| Google private key | `.env` | Must not appear |
| MongoDB URI | `.env` | Must not appear |
| Internal API secret | `.env` | Must not appear |
| Session cookies | JSON file | Debug only — treat as secret |

Logger uses structured pino — avoid logging full config objects.

---

## Sensitive data in exports

Combined creator files may contain:

- TikTok usernames and creator IDs
- Performance metrics
- CRM email/phone when enrichment applied

Treat `data/processed/` and Google Sheets as **confidential agency data**.

---

## External integration risks

| Integration | Risk | Mitigation |
|-------------|------|------------|
| Unauthenticated `/run-now` | Anyone on LAN triggers expensive job | Firewall; future auth header |
| Saved Backstage session | Session theft = agency access | Filesystem permissions; re-login rotation |
| Google key in `.env` | Key leak = Drive/Sheet access | Rotation; never commit |
| Profile scraping | TikTok ToS / rate limits | Batch limits, stale hours |
| Internal API secret | Leak enables highlight spam | Rotate secret; keep disabled until ready |

---

## Threat considerations

- **Not suitable** for direct exposure to the public internet without reverse proxy + auth
- **Insider threat** on server PC has full access to all credentials
- **Supply chain** — npm dependencies; run `npm audit` periodically
- **Backstage UI XSS** — not mitigated by gatherer; browser runs with agency privileges

---

## Known gaps

1. No authentication on dashboard and trigger endpoints
2. No HTTPS termination in app (plain HTTP on 3099)
3. No encryption at rest for `backstage-auth.json`
4. No audit trail of API triggers
5. Failure emails may include error details — verify content before enabling in shared mailboxes

---

## Manual verification required

These cannot be confirmed from code alone:

- Google Workspace domain-wide delegation is correctly scoped
- MongoDB Atlas IP allowlist includes server PC
- Firewall rules restrict port 3099 to trusted networks
- InfiniView API internal secret matches production deploy
- Backstage account MFA policy

---

## Reporting

See [SECURITY.md](../SECURITY.md) for private vulnerability reporting.
