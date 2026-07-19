# Runbook: Operator session

**Scope:** starting a periodic operator session (Claude Code or the admin console), submitting
leads/sources/evidence through `packages/operator-cli`, running a bounded discovery campaign,
drafting a case toward review-ready, and closing the session correctly.
**Not in scope:** promotion/publication (/032 — a distinct, fresh-auth reviewer action),
adapter/source fetching (`packages/domain/src/adapters/**`), and live IAP/Firebase
authentication for the admin console's quick-add route (documented gap below).

## The one invariant every task in this runbook respects

**Proposer is never approver.** Everything in this runbook — the CLI, the four
`.claude/skills/black-book/` skills, and the admin console's `/quick-add` route — lands data in
the *existing*  submission quarantine and  research-case pipeline. None of it can
publish, promote, or approve anything: `evaluatePromotionGate`
(`packages/domain/src/promotion/controls.ts`) refuses when the approver id equals the proposer
id, and 's `promote`/`retract` actions require a *fresh* (≤10 minute), separately
authenticated `publication`-role token (`assertRecentReauth`,
`packages/firebase/src/admin-auth.ts`) — something a long-running operator session never holds.
`packages/operator-cli/src/promotion-boundary.test.ts` proves this mechanically; read it if you
want to see the exact gate calls.

## Start here

1. Run `bd prime` if you haven't this session — it's this repo's issue-tracker workflow context,
   independent of everything below.
2. Set `OPERATOR_CLI_PRIVACY_PEPPER` in your shell (any stable string for a dev/local session;
   a real secret for anything touching a real project). It only digests optional submitter
   contact info — never logged or stored raw.
3. Decide your operator identity for this session: a stable `--operator-id` (your name or a
   consistent handle) and a fresh `--session-id` (e.g. `date +%Y%m%d-%H%M`). Both get stamped
   onto every proposal's audit event and quarantine payload.
4. Know which surface you're using:
   - **Claude session / terminal** → the CLI directly, or through one of the four skills below.
   - **Admin console** → `/quick-add` (paste a URL, see below) or `/console` (read-only fixture
     shell today — see its "Known gaps" note).

## Common tasks

### Submit a lead

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts submit-lead \
  --description "What you found and why it matters" \
  --url "https://source.example.org/item" \
  --location "City, State" --era "1960s" \
  --operator-id "$OPERATOR_ID" --session-id "$SESSION_ID"
```

Prints the prepared quarantine submission + draft research case as JSON. Nothing is written
until you add `--commit`. See `.claude/skills/black-book/research-intake/SKILL.md` for the
fetch-first variant (`research-intake` command), which pre-fills the citation from the URL.

### Register a source

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts register-source \
  --org "Greenwood Historical Society" --homepage "https://greenwoodhistory.example.org" \
  --notes "Digitized newspaper runs 1920-1970" \
  --operator-id "$OPERATOR_ID" --session-id "$SESSION_ID"
```

This *proposes* the source into the same quarantine queue a lead uses — it does not write to
the `evidenceSources` registry. A reviewer actions it through the existing
source-registry workflow.

### Attach evidence to a research case

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts attach-evidence \
  --case-id "case-340" --description "Corroborates the 1962 plaque date" \
  --source-url "https://directories.example.org/1962/entry-88" \
  --operator-id "$OPERATOR_ID" --session-id "$SESSION_ID"
```

See `.claude/skills/black-book/case-drafting/SKILL.md` for evaluating what a case is missing
before you go looking for a source to fill it, and
`.claude/skills/black-book/triage-graylist/SKILL.md` for walking already-parked candidates.

### Bulk-import leads from CSV or markdown notes

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts bulk-import \
  --file leads.csv --operator-id "$OPERATOR_ID" --session-id "$SESSION_ID"
```

CSV columns: `title,description,url,sourceUrls,location,era,targetRecordId,submitterContact`
(header row required; `sourceUrls` is `;`-separated). Markdown format: one `### Title` heading
per lead, followed by `Key: value` lines (`Description`, `Source`/`Url` — repeatable, `Location`,
`Era`, `Target`, `Contact`) — see `packages/operator-cli/src/bulk-import.ts` for the exact
grammar and `packages/operator-cli/src/bulk-import.test.ts` for worked examples. Each row is
validated and reported individually; one bad row never blocks the rest of the batch.

### Run a bounded discovery campaign

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts discovery-run \
  --batch path/to/batch.json --campaign-id "campaign-$(date +%Y%m%d)" --countries US \
  --max-candidates 100 --max-quarantined 10 --max-dead-letter 5 --continue-on-quarantine
```

Requires an already-assembled batch file (`{pack, records, runContext}`) — this command runs
the real  gate over it and reports yield; it does not fetch from any adapter itself. See
`.claude/skills/black-book/discovery-run/SKILL.md`.

### Run community-feed obscurity discovery (dry-run)

Weekly schedule is declared as `community-obscurity-discovery` (Sundays 10:00 UTC); GCP
Scheduler apply is still a human step. For an on-demand dry-run, pass a local feed XML file
(no network fetch in this command):

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts community-obscurity-run \
  --feed-xml feed_the_american_blackstory=packages/domain/src/adapters/rss/fixtures/the-american-blackstory.trimmed.rss.xml \
  --catalog-titles "Rosa Parks|Martin Luther King Jr.|Buffalo Soldiers|Harriet Tubman"
```

Private candidates + obscurity ranking only — never publishes. See
`docs/research/discovery-pipeline.md`.

### Run editorial / enrichment (LLM stage-only)

```bash
# List pending from an obscurity summary JSON
node --conditions development --import tsx packages/operator-cli/src/bin.ts pending-list \
  --from /tmp/obscurity.json

# Draft keep/reject + linked prose (mock default; use --provider openrouter|ollama)
# --catalog-from=firestore loads entityEmbeddings vectors for related suggestions
OPERATOR_CLI_PRIVACY_PEPPER=dev node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts editorial-run \
  --subjects /tmp/subjects.json \
  --catalog-from=firestore \
  --provider mock \
  --operator-id "$USER" --session-id "sess-$(date +%s)" --identity-source cursor_session
```

One-time (or incremental) embedding backfill into `entityEmbeddings`:

```bash
GEMINI_API_KEY=... APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
  node --conditions development --import tsx \
  packages/firebase/src/embeddings/backfill-cli.ts \
  --source=publicSearchIndex --max-items 600 --max-cost-usd 1
```

Add `--commit` only after review — stages quarantine `editorial_packet` proposals, never
publishes. Skill: `.claude/skills/black-book/editorial-enrichment/SKILL.md`.

### Commit a prepared proposal

Every command above defaults to a dry run (prints the prepared result, writes nothing). Add
`--commit` once you've reviewed the output and want it written through 's real
`commitWithAudit`:

```bash
GOOGLE_APPLICATION_CREDENTIALS=... node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts submit-lead ... --commit
```

`--commit` needs Firestore Admin SDK credentials for the target project (or emulator env vars —
see `apps/admin/.env.example`). There is no `--publish`, `--approve`, or `--promote` flag on
this CLI, anywhere — publication is a separate action through /032's own gated tooling
with a distinct, fresh-authenticated approver identity.

### Admin console quick-add

Navigate to `/quick-add` in `apps/admin`. Paste a URL, optionally add notes/location/era and
your operator id, and submit. The route fetches through  safety, pre-fills a citation,
notes the (currently unwired) Wayback capture point, and prepares a draft research case through
the same `runResearchIntake` the CLI's `research-intake` command uses. The "Commit to
quarantine pipeline" button is intentionally disabled, matching `/console`'s existing pattern —
commit the exact prepared proposal via the CLI's `--commit` flag instead.

**Known, documented gap:** `/quick-add` does not yet read a verified IAP/Firebase administrator
identity (no route in `apps/admin` wires `createServerAdminAuthorizer` into a request handler
yet). Until that lands, the operator identifies themselves via a plain "Operator id" form
field. Swap that for a verified identity once 's live wiring reaches this route.

## End-of-session checklist

This repo's `AGENTS.md`/`CLAUDE.md` session-completion protocol is mandatory and unchanged by
this runbook — follow it exactly:

1. **File issues for remaining work** (`bd` — not TodoWrite/markdown TODOs).
2. **Run quality gates** for anything you changed:
   ```bash
   pnpm --filter @repo/operator-cli test
   pnpm --filter @repo/operator-cli typecheck
   pnpm --filter @repo/admin typecheck
   ```
3. **Update issue status** — close finished `bd` work, update in-progress items.
4. **Push to remote** (mandatory — work is not done until this succeeds):
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # must show "up to date with origin"
   ```
5. **Clean up** — clear stashes, prune remote branches.
6. **Verify** — everything committed and pushed.
7. **Hand off** — leave enough context (this runbook + your `bd` notes) that the next session,
   human or agent, is productive in minutes.

Session ergonomics specific to this runbook: note in your handoff which `--session-id` you
used and whether anything is still sitting un-committed (dry-run only) so the next session
doesn't duplicate the fetch/validation work.
