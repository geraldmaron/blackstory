# Research kernel

`@repo/research-kernel` is the domain-agnostic contract layer for evidence-first research. The
Supabase/Postgres schemas remain the canonical ledger; JSON files in the package are versioned wire
contracts and profile configuration, not a second datastore.

## Contract flow

`schemas/research-kernel.v1.schema.json` is the JSON Schema 2020-12 source of truth. The generator
derives:

- immutable TypeScript interfaces in `src/generated/contracts.ts`;
- Pydantic models in `python/src/research_kernel/models.py`.

Both generated files are checked in so consumers do not need a generator at runtime. CI and local
builds run `generate:check` and fail if either generated surface drifts from the schema.

The schema covers research profiles; source policies and captures; Web Annotation evidence
selectors; claims, qualifiers, evidence assignments, and confidence components; questions,
hypotheses, evidence needs, and frontier tasks; entity candidates and reversible resolution;
W3C-PROV-aligned runs and activities; model invocations and invalid-output quarantine; artifacts,
independent review, releases, story cite maps, and RO-Crate exports.

## Ledger design

Migration `20260721041950_research_kernel_ledger.sql` extends the existing `bb_*` schemas. Queryable
facts are normalized into tables and join tables with foreign keys and indexes. JSONB is limited to
versioned profile/provider payloads, review findings, and infrequently queried extensions.

The migration adds non-blocking frontier leasing with `FOR UPDATE SKIP LOCKED`, heartbeats, retry
ceilings, dead letters, idempotency keys, and outbox events. Artifact submission, independent
approval, and research-release activation are scoped security-definer RPCs with empty search paths,
explicit grants, actor checks, and distinct producer/reviewer lineage.

Automatic public promotion is disabled in the Black history profile. Story release still requires a
separate approval decision and explicit activation.

## Model output

Structured tasks send provider-supported `json_schema` response formats. Parsing accepts exactly one
JSON document; it does not scan braces, strip prose, coerce malformed output, or silently repair it.
Invalid raw output is retained with invocation and schema lineage. Any repair must use a new activity
and invocation linked to the original.

## Verification

```bash
pnpm --filter @repo/research-kernel test
pnpm --filter @repo/research-kernel typecheck
uv run pytest packages/research-kernel/python/tests/test_models.py -q
pnpm dlx supabase@latest db reset --local --no-seed --yes
docker exec -i supabase_db_twykhihqkcldpreuovay \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - \
  < supabase/tests/research-kernel.sql
```

The SQL verification transaction covers lease claim/heartbeat/completion, append-only claim
versions, self-approval rejection, independent approval, release activation, and denial of release
activation to the research role.
