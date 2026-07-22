<!--
  Operator runbook for cutting public apps/web from Firebase App Hosting to Vercel.
  Prep-only until DNS flip is explicitly approved.
-->

# Runbook: Vercel public-web cutover

**Bead:** `repo-gm3w`  
**ADR:** [ADR-027](../adr/ADR-027-vercel-public-web-hosting.md)  
**Project:** Vercel `geraldmarons-projects/blackstory` (`prj_AJYcJozo2XqLfBXItGxHV5SQP06h`)  
**Root Directory:** `apps/web`

## Current state (pre-hard-cut)

| Item | Value |
|------|--------|
| Preview / default alias | `https://blackstory-geraldmarons-projects.vercel.app` |
| Git production branch | `main` (Git connected) |
| Production DNS (`blackstory.app`) | **Still App Hosting — do not flip until checklist below** |
| Dual-run | App Hosting `apphosting*.yaml` retained; Next uses `standalone` only when `VERCEL` is unset |

## Agent / MCP

- Cursor MCP endpoint: `https://mcp.vercel.com` (server id `user-vercel` after OAuth)
- Prefer MCP `list_deployments` / `get_deployment_build_logs` / `get_runtime_logs` for diagnosis
- CLI fallback: `vercel` (linked via `.vercel/project.json`, gitignored)

## Preview validation (required before hard cut)

1. Deploy Preview from a linked branch or `vercel` (non-`--prod`) from a clean tree with current `apps/web` config.
2. Confirm:
   - Homepage renders (not empty seed-only dig)
   - `/explore` shows live catalog (~1k+ records when `PUBLIC_DATA_SOURCE=postgres`)
   - Security headers still present
   - No App Hosting-only assumptions in runtime logs
3. Soak Preview for at least one owner review session.

## Environment variables

Set on the Vercel project (Preview + Production unless noted):

| Key | Notes |
|-----|--------|
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `NEXT_PUBLIC_SITE_URL` | Preview: `*.vercel.app` alias; Production: `https://blackstory.app` |
| `PUBLIC_DATA_SOURCE` | `postgres` |
| `PUBLIC_READ_API_DISABLED` | `0` (or `1` to force degraded mode) |
| `REQUEST_INTEGRITY_MODE` | `enforce` |
| `DATABASE_SSL` | `1` |
| `DATABASE_URL` | Sensitive; service-role / pooler URL from 1Password (`Supabase: blackstory-app`) |
| `SENTRY_DSN` | Optional; add before hard cut if production error tracking is required |

Update without printing secrets:

```bash
# example: rotate DATABASE_URL (stdin / --value; never commit)
vercel env add DATABASE_URL production --sensitive --force --yes --value "$DATABASE_URL"
vercel env add DATABASE_URL preview --sensitive --force --yes --value "$DATABASE_URL"
```

## Hard cut (explicit owner approval only)

1. Freeze App Hosting production promotes (`deploy-production.yml` / promote scripts) for the cut window.
2. Promote a known-good Vercel Preview → Production (`vercel promote <url>` or dashboard).
3. Attach custom domains in Vercel: `blackstory.app` + `www` (or apex-only per DNS plan).
4. Lower DNS TTLs ahead of time; switch records to Vercel’s targets.
5. Verify production URL + Explore catalog + TLS.
6. Keep App Hosting backend idle (do not delete) for rollback soak (suggested ≥48h).
7. After soak: document App Hosting wind-down; update README architecture table.

## Rollback

1. Repoint DNS to prior App Hosting / Firebase Hosting records.
2. Re-enable App Hosting promote for the last known-good SHA.
3. Leave the Vercel project intact for log forensics.

## Do not

- Host `apps/admin` on this Vercel project (IAP boundary — ADR-001 / ADR-005).
- Enable unattended production deploys on every `main` push without amending ADR-006 / ADR-027.
- Delete App Hosting configs or Secret Manager secrets during the soak window.
- Put bead ids or secrets in user-facing copy.
