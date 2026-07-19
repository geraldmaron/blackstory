---
name: black-book-editorial-enrichment
description: Use when the owner wants to check pending discovery/obscurity leads, run editorial or enrichment with an LLM (OpenRouter free/local/mock), weed bad items, draft linked prose, and stage packets for quarantine — never publish. Triggers on "check pending", "run editorial", "run enrichment", "stage for publish".
---

# Editorial enrichment (staging only)

Runs the operator-cli editorial/enrichment lane. LLM drafts stay proposals. Promotion and
release activation are out of scope for this skill.

## Secrets

```bash
# OpenRouter (1Password via run-with-dev-secrets)
run-with-dev-secrets -- env | rg OPENROUTER

# Or local / Corsair Ollama (no key)
export EDITORIAL_LLM_PROVIDER=ollama
export OLLAMA_MODEL=qwen3:8b
export OLLAMA_BASE_URL=http://100.119.72.84:11434/v1   # Corsair via Tailscale
```

Overnight Corsair job (SearXNG + Wikimedia + hybrid enrichment):
`docs/runbooks/overnight-hybrid-enrichment.md`. Dev Guides:
`~/Developer/Guides/Workflows.md`, `CLI-Reference.md`, `Secrets-1Password.md`.

## Pending list

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts pending-list \
  --from /tmp/obscurity-summary.json
```

## Editorial / enrichment (dry-run default)

Subjects file shape: `{ "subjects": [{ "subjectId", "title", "existingSummary?" }] }`.
Optional catalog JSON: `{ "entities": [{ "id", "displayName", "aliases?", "vector?" }] }`.
Prefer live vectors after backfill: `--catalog-from=firestore` (joins `entityEmbeddings` +
`publicSearchIndex`).

```bash
OPERATOR_CLI_PRIVACY_PEPPER=dev node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts editorial-run \
  --subjects /tmp/subjects.json \
  --catalog-from=firestore \
  --provider mock \
  --operator-id "$USER" --session-id "cursor-$(date +%s)" --identity-source cursor_session
```

Embed public catalog first (Gemini Developer API key):

```bash
GEMINI_API_KEY=… APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
  node --conditions development --import tsx \
  packages/firebase/src/embeddings/backfill-cli.ts \
  --source=publicSearchIndex --max-items 600 --max-cost-usd 1
```

Providers: `mock` (default), `openrouter`, `ollama`, `hybrid`. Pass `--model openrouter/free`
and optional `--ollama-model qwen3:8b` / `--concurrency N` when not using mock.

Enrichment is the same judge with result kind `enrichment.run.v1`:

```bash
… enrichment-run --subjects … --provider hybrid \
  --model openrouter/free --ollama-model qwen3:8b --concurrency 4 …
```

## Commit (stage only)

Add `--commit` only after the owner reviews JSON. That writes quarantine
`editorial_packet` proposals (and may open draft research cases for keep/needs_evidence).
There is no `--publish` / `--promote`.

## Prose links

Summaries should use `[[ent_id|Display Name]]` so the web `LinkedProse` component renders
`EntityLink`s. Catalog linkify also auto-links plain names against related neighbors.

## Never

- Never call promotion gates or release activation.
- Never treat LLM confidence as publication authority.
- Never skip `validationIssues` on packets — surface them to the owner.
