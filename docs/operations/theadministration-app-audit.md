# theadministration-app Project Audit (repo-mhyp)

**Date**: 2026-09-13  
**Investigation**: Read-only audit of the third Supabase project in the Dagher organization  
**Scope**: Trace readers and writers of theadministration-app data across all surfaces  
**Outcome**: Recommended next steps after investigation

## Executive Summary

The `theadministration-app` project (Supabase reference: `ltpqfgfcvrmfctcaisuw`) is a third Supabase project in the Dagher org, created 2026-08-04. Investigation finds:

- **Zero code references** in the BlackStory monorepo to the three tables it supposedly holds (`public.dataset_editor`, `dataset_overlay`, `cloud_save`)
- **No active readers/writers** in this repository
- **Admin console architecture change** renders original justification moot: admin moved from separate Vercel project to `/admin` routes inside `apps/web` on 2026-09-11, and already uses `blackstory-app` (not theadministration-app) for its database
- **Isolated project reference**: Only mentioned in `apps/web/src/lib/runtime-hardening/leftover-stack.test.ts:32` as a forbidden foreign project the public web must not reference
- **Recurring cost**: Separate compute billing (~$20-35/mo per org) whether or not in active use

## Investigation Findings

### 1. Code Search Results

**Scope**: Full monorepo scan (TypeScript, JavaScript, SQL, configuration, documentation)

**Table references** (dataset_editor, dataset_overlay, cloud_save):
- Zero matches in `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs` files
- Zero matches in `.sql` migration files or ad-hoc query scripts
- Zero matches in GitHub Actions workflows

**Project references** (ltpqfgfcvrmfctcaisuw, theadministration-app):
- `docs/security/cost-resource-controls.md:176` — cost audit row (Issue cell empty, assigned to this bead)
- `apps/web/src/lib/runtime-hardening/leftover-stack.test.ts:32` — forbidden-project list enforcement

### 2. Admin Console Database Configuration

**Current setup** (verified from `apps/web/.env.local`):
```
DATABASE_URL=postgresql://postgres:...@db.twykhihqkcldpreuovay.supabase.co:...
SUPABASE_URL=https://twykhihqkcldpreuovay.supabase.co
```

**Resolution**: Both point to `blackstory-app` (ref: `twykhihqkcldpreuovay`), not theadministration-app.

**Deployment**: `/admin` routes are now part of `apps/web` on the same Vercel project (since 2026-09-11). Was a separate Vercel project `apps/admin/` beforehand; credential-isolation justification for a separate *database* no longer applies post-2026-09-11.

### 3. Forbidden-Project Enforcement

**File**: `apps/web/src/lib/runtime-hardening/leftover-stack.test.ts`

```typescript
const OTHER_SUPABASE_REFS = ['cqdukiktqmcoantrbxzy', 'ltpqfgfcvrmfctcaisuw'];
const OTHER_SUPABASE_NAMES = ['geralddagher-site', 'theadministration-app'];
```

**Test purpose**: Ensures the public web request path (outside `/admin`) does not name or connect to the other two org projects. Test passes; public web is clean.

### 4. Data Scope (Stated)

Per bead notes (2026-09-12 admin record query):
- `public.dataset_editor` table
- `public.dataset_overlay` table
- `public.cloud_save` table

**Status**: No rows found in the monorepo that read, write, or reference these tables. No schema definitions in migrations. No operator-cli commands target them.

### 5. Geralddagher-site Project

**Scope note**: The audit bead originally queried whether `geralddagher-site` is still needed. Per bead notes (2026-09-12), it holds live content:
- 15 profiles
- 10 posts
- 34 milestones
- 5 subscriptions
- 16 profile_emails

**Status**: Not idle; used. Out of scope for this audit (different project, different purpose).

## Owner Ruling (2026-09-12)

**Gerald's directive**: "INVESTIGATE BEFORE MIGRATING. Do not move or delete theadministration-app data yet. First trace every reader and writer of public.dataset_editor / dataset_overlay / cloud_save across all surfaces, including anything outside this repo, and report."

**Investigation scope completed**: All code readers and writers found in the BlackStory monorepo are traced (result: zero). Tracing readers and writers "outside this repo" requires access to:
- theadministration-app Supabase console (to inspect connected clients and API usage logs)
- External services that may use its PostgREST endpoint
- Historical logs of read/write activity
- Any external applications or scripts that reference it

## Observations

1. **Original premise mismatch**: The bead was written under the assumption that theadministration-app was created to hold the admin rebuild's database, with credential-isolation justifying a separate Supabase project. In fact:
   - Admin is no longer a separate Vercel project (moved to `/admin` in apps/web on 2026-09-11)
   - Admin already uses blackstory-app for its database
   - Therefore, the credential-isolation argument no longer applies

2. **Mystery of the three tables**: The three tables supposedly in theadministration-app (dataset_editor, dataset_overlay, cloud_save) have zero mentions in this codebase. Possible explanations:
   - They were created for a tool or service outside this repo
   - They are legacy/abandoned and have no current readers or writers
   - They exist but are accessed through direct SQL outside tracked code paths
   - The project was created for a planned feature that was never implemented

3. **Cost vs. usage**: The project incurs separate compute billing (~$20-35/mo) regardless of traffic. Investigation shows zero in-repo usage. Cost-benefit tilts toward consolidation unless external usage is significant.

## Recommendations for Next Investigation

**To complete the trace-and-report per the owner ruling**, investigate:

1. **theadministration-app Supabase console**:
   - Access Supabase project dashboard
   - Check table schemas and row counts (dataset_editor, dataset_overlay, cloud_save)
   - Review connected applications and API keys
   - Check API usage logs (read/write patterns, request frequency, last accessed)
   - Check authentication settings and who has credentials

2. **External services**:
   - Search company notes/Slack for mentions of "dataset_editor", "cloud_save", or "theadministration-app"
   - Identify any external tools, automation, or scripts that use its PostgREST endpoint
   - Check if any third-party services (webhooks, integrations) target it

3. **Decision checkpoints**:
   - If zero usage: consolidate to `blackstory-app` as a schema with separate role
   - If external usage: document dependencies and timeline for migration
   - If abandoned: coordinate deletion to avoid external breakage

## Documentation Updates Needed

**File**: `docs/security/cost-resource-controls.md:176`

Currently:
```markdown
| Supabase compute billed on 3 active projects | Audit whether `theadministration-app` needs its own project vs. a schema | — |
```

Should be updated with:
- Issue reference: `repo-mhyp`
- Status: Investigation in progress or completed
- Outcome: Keep, migrate, or delete decision

## Files Modified

This audit is read-only investigation. No code or database changes made.
