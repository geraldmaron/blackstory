# theadministration-app Project Audit (repo-mhyp)

**Date**: 2026-09-13  
**Investigation**: Read-only audit of the third Supabase project in the Dagher organization  
**Scope**: Trace readers and writers of theadministration-app data across all surfaces  
**Outcome**: The trace the owner asked for, in-repo and external, plus the one decision it leaves

## Executive Summary

The `theadministration-app` project (Supabase reference: `ltpqfgfcvrmfctcaisuw`) is a third Supabase project in the Dagher org, created 2026-08-04. Investigation finds:

- **Zero code references** in the BlackStory monorepo to the three tables it supposedly holds (`public.dataset_editor`, `dataset_overlay`, `cloud_save`)
- **No active readers/writers** in this repository
- **Admin console architecture change** renders original justification moot: admin moved from separate Vercel project to `/admin` routes inside `apps/web` on 2026-09-11, and already uses `blackstory-app` (not theadministration-app) for its database
- **Isolated project reference**: Only mentioned in `apps/web/src/lib/runtime-hardening/leftover-stack.test.ts:32` as a forbidden foreign project the public web must not reference
- **Recurring cost**: Separate compute billing (~$20-35/mo per org) whether or not in active use

And then, from OUTSIDE the repo, which is the half the owner's ruling actually turned on. See
"The external trace" below: the project is not empty, and it is not inert.

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

## The external trace (2026-09-13)

The owner's ruling said "across all surfaces, **including anything outside this repo**." The first
pass answered only the in-repo half and filed the rest as a future console session. That was
unnecessary: the Supabase management API reaches this project directly, read-only, and answers it.

**Tables** (`list_tables` on `ltpqfgfcvrmfctcaisuw`):

| Table | Rows | RLS |
|---|---:|---|
| `public.dataset_editor` | 1 | on |
| `public.dataset_overlay` | 0 | on |
| `public.cloud_save` | 0 | on |
| `storage.objects` | **38** | on |
| `storage.buckets` | 1 | on |
| `auth.users` | 1 | on |

**Traffic** (unified logs, trailing 24h): 9 `postgres_logs` entries and nothing else. No
`edge_logs`, so no PostgREST or Storage API request reached the project in that window.

**Two findings the first pass could not have had, and both change the recommendation.**

**A. The project is not empty — 38 storage objects are in it.** The three tables the bead names
hold one row between them, which reads like an abandoned project. The storage bucket does not.
Nobody has said what those 38 objects are, and "pause it" is not a safe instruction while that is
true: pausing a Supabase project takes its storage offline with it. Identify them first.

**B. Two `SECURITY DEFINER` functions are callable by `authenticated` over PostgREST**, per the
project's own security advisor:

- `public.publish_dataset_overlay(row_ids uuid[])` via `/rest/v1/rpc/publish_dataset_overlay`
- `public.save_dataset_overlay_edit(p_record_id text, p_field_path text, p_base_value jsonb, p_new_value jsonb, p_note text)` via `/rest/v1/rpc/save_dataset_overlay_edit`

A `SECURITY DEFINER` function runs as its owner, so `EXECUTE` granted to `authenticated` means any
signed-in user of this project can invoke a privileged write. The project has exactly one auth
user today, which bounds the exposure but does not remove it, and it is a live externally-facing
surface on a project nothing in this repo is watching. The advisor also reports leaked-password
protection disabled on that project's Auth.

This is the same class of issue the main project's SECURITY DEFINER audit covers, on a project
that audit does not look at.

## What is left to decide

Not "go and look" — the looking is done. Three things, in order:

1. **Identify the 38 storage objects.** Until they have an owner, nothing should be paused or
   deleted. If they are reader-facing assets, they belong in `blackstory-app`'s media bucket
   alongside everything else (which is the same move `repo-z9li` makes for article hero images).
2. **Deal with the two exposed functions regardless of the keep-or-fold decision.** Revoke
   `EXECUTE` from `authenticated`, or switch them to `SECURITY INVOKER`, or move them out of the
   exposed schema. This should not wait on the fate of the project.
3. **Then decide keep vs fold.** With one row across the three named tables and no API traffic in
   24 hours, the evidence points at folding into `blackstory-app` and retiring this project — but
   that is a decision to make after (1), not before.

What genuinely remains outside these tools: whether an external consumer exists that simply did not
run in the last 24 hours. The log window caps at 24 hours, so a weekly job would not appear in it.
Treat "no traffic" as "no traffic in one day," not as "no consumer."

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
