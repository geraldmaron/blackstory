# Runbook: Legacy GCP production project ID (`black-book-efaaf`)

**Scope:** Documents why the BlackStory production Google Cloud project keeps the immutable
project ID `black-book-efaaf`, and lists the human-only rename steps that must happen outside
Terraform. **Not executed by this document.** No `gcloud`, `firebase`, or `terraform apply`
command here has been run by any agent session.

## Immutable production project ID

| Field | Value | Notes |
|-------|-------|-------|
| Project ID | `black-book-efaaf` | **Immutable.** GCP project IDs cannot be renamed after creation. All prod Terraform, Firebase CLI defaults, WIF bindings, and live IAM references must keep this string. |
| Display name | `BlackStory` | Human-facing console label only. Safe to update in the GCP console without changing the project ID. |
| Product | BlackStory | User-visible product name (see `brand/` and `@repo/config` identity helpers). |

The ADR-012 three-project topology retains this project as production. New non-prod projects
use functional IDs `repo-staging` and `repo-internal` with display names **BlackStory Staging**
and **BlackStory Internal** (see `infra/gcp/terraform/multi-project/`).

**Do not:**

- Change `prod_project_id` defaults or validation away from `black-book-efaaf`.
- Recreate the production project under a new ID.
- Assume a GitHub repo rename or local folder rename updates GCP project IDs automatically.

## Human checklist (outside Terraform)

Complete these manually when the organization is ready. Each step is independent of
`terraform apply`; order below is recommended.

### 1. GCP console display name

- [ ] Open [Google Cloud Console](https://console.cloud.google.com/) → project **`black-book-efaaf`**.
- [ ] **IAM & Admin → Settings** (or project picker → **Edit project**).
- [ ] Set **Project name** (display name) to **`BlackStory`**.
- [ ] Confirm **Project ID** still reads **`black-book-efaaf`** — do not attempt to change it.
- [ ] Repeat for new projects when they exist: **`repo-staging`** → display name **BlackStory Staging**; **`repo-internal`** → display name **BlackStory Internal**.

### 2. Firebase console display name

- [ ] Open [Firebase Console](https://console.firebase.google.com/) → project linked to **`black-book-efaaf`**.
- [ ] **Project settings → General** → set **Public-facing name** to **`BlackStory`** (or equivalent display field).
- [ ] Verify `.firebaserc` still maps `default` and `production` to **`black-book-efaaf`** — project ID values do not change.
- [ ] After staging/internal Firebase apps exist, align their console display names with **BlackStory Staging** / **BlackStory Internal**; keep Firebase project IDs aligned with `repo-staging` / `repo-internal`.

### 3. GitHub repository rename

- [ ] Decide target slug (e.g. **`blackstory`** or org-owned equivalent) with stakeholders.
- [ ] **Settings → General → Repository name** → rename from legacy slug (e.g. `black-book`) to the chosen name.
- [ ] Update local remotes: `git remote set-url origin <new-url>`.
- [ ] Audit and update: GitHub Actions secrets/environments, branch protection, Vercel/other deploy hooks, WIF provider trust conditions (`infra/gcp/wif/`), and any hard-coded clone URLs in docs or CI — **not** GCP/Firebase project IDs.
- [ ] Confirm OIDC `repository` claim matches the new owner/name before the next deploy.

### 4. Local development folder rename

- [ ] Close editors and terminals using the old checkout path.
- [ ] Rename the workspace directory (e.g. `black-book` → `blackstory`) at the filesystem level.
- [ ] Re-open the project from the new path; update shell aliases, IDE recent projects, and any absolute paths in personal tooling (not committed repo config unless intentionally updated elsewhere).
- [ ] Run `git status` and a smoke test (`npm test` or project-standard gate) from the new location.

## Related references

- [ADR-012: Production environment re-split](../adr/ADR-012-production-environment-resplit.md)
- [`production-environment-resplit-migration.md`](./production-environment-resplit-migration.md)
- [`infra/gcp/terraform/multi-project/`](../../infra/gcp/terraform/multi-project/)
- Root `.firebaserc` — production Firebase project ID remains **`black-book-efaaf`**
