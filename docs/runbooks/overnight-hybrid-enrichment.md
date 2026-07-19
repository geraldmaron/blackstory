# Overnight hybrid enrichment (Corsair)

Nightly (or one-shot) discovery + LLM enrichment on the Corsair AI workstation over
Tailscale. Staging only by default — never publishes.

## What it does

1. **SearXNG web-search** (optional) — roster queries via
   `scripts/run-scheduled-searxng-discovery.sh`; survivors can commit to private
   Firestore `researchCases` for admin review.
2. **Wikimedia discovery** — multi-round `packages/firebase/scripts/discover-candidates.ts`
   with `--merge` until `TARGET_CANDIDATES` (default 1000) or `DISCOVERY_ROUNDS` exhausted.
3. **Hybrid enrichment** — `operator-cli enrichment-run --provider hybrid --concurrency N`
   - Primary: OpenRouter `openrouter/free`
   - Failover: Ollama on Corsair (`qwen3:8b`, native `/api/chat` with `think: false`)
   - Per-item failures become `needs_evidence` (batch does not abort)

## Host

| | |
|---|---|
| Host | `gerald-corsair-ai-workstation-300` / `100.119.72.84` |
| SSH | `ssh gerald@100.119.72.84` |
| Repo path on Corsair | `~/Developer/Projects/blackstory` (rsync tree; may lack `.git`) |
| Node | nvm **22** (required by package engines) |
| Ollama | `http://127.0.0.1:11434` |
| SearXNG | `http://127.0.0.1:8888` |

## Install / enable

```bash
# From Mac blackstory checkout — sync units
scp scripts/systemd/blackstory-overnight-enrichment.* \
  gerald@100.119.72.84:~/.config/systemd/user/
ssh gerald@100.119.72.84 'systemctl --user daemon-reload
systemctl --user enable --now blackstory-overnight-enrichment.timer
loginctl enable-linger "$USER"'
```

Timer default: **02:15** local. Script entry:
`scripts/run-overnight-hybrid-enrichment.sh`.

## Secrets

Never commit. On Corsair:

| File | Purpose |
|---|---|
| `~/.config/blackstory/enrichment.env` | `OPENROUTER_API_KEY`, optional pepper |
| `~/.config/blackstory/discovery.env` | Firebase ADC path, pepper, `APP_FIREBASE_ALLOW_PRODUCTION` |

OpenRouter key lives in 1Password vault `geralddagher-development` (same item as
`OPENROUTER_API_KEY` in `~/.env.1password`). Provision / refresh:

```bash
# See ~/Developer/Guides/Secrets-1Password.md — never print the key
KEY="$(op read 'op://geralddagher-development/dafetkmn7fmieht4g57eh7dyb4/credential')"
printf 'OPENROUTER_API_KEY=%s\nEDITORIAL_LLM_PROVIDER=hybrid\n' "$KEY" | \
  ssh gerald@100.119.72.84 'umask 077; cat > ~/.config/blackstory/enrichment.env'
unset KEY
# Re-append OPERATOR_CLI_PRIVACY_PEPPER from discovery.env if needed
```

## Run / monitor

```bash
ssh gerald@100.119.72.84 'systemctl --user start blackstory-overnight-enrichment.service'
ssh gerald@100.119.72.84 'journalctl --user -u blackstory-overnight-enrichment.service -f'
ssh gerald@100.119.72.84 'systemctl --user list-timers | grep blackstory'
ssh gerald@100.119.72.84 'ls -lt ~/Developer/Projects/blackstory/.cache/overnight-enrichment | head'
```

Artifacts under `.cache/overnight-enrichment/`:

- `subjects-*.json` — enrichment inputs
- `run-*.json` — full enrichment result
- `summary-*.json` — keep/reject/error counts + `servedBy` (openrouter vs ollama)

Candidates fixture: `packages/firebase/fixtures/discovery-candidates/run-*.json`.

## Env knobs

| Variable | Default | Meaning |
|---|---|---|
| `TARGET_CANDIDATES` | 1000 | Stop Wikimedia rounds when merged pool ≥ this |
| `DISCOVERY_LIMIT` | 40 | Wikipedia hits per seed query |
| `DISCOVERY_ROUNDS` | 3 | Max merge rounds |
| `DISCOVERY_CONCURRENCY` | 2 | Parallel Wikimedia queries (keep low — 429s) |
| `ENRICH_CONCURRENCY` | 4 | Parallel enrichment subjects |
| `SKIP_SEARXNG` | 0 | Skip SearXNG phase |
| `SKIP_DISCOVERY` | 0 | Skip Wikimedia phase |
| `COMMIT_ENRICHMENT` | 0 | `1` = stage quarantine packets (`--commit`) |
| `COMMIT_SURVIVORS` | 1 | SearXNG survivors → Firestore |
| `OLLAMA_MODEL` | `qwen3:8b` | Failover model |
| `OPENROUTER_MODEL` | `openrouter/free` | Primary model |

Override via systemd drop-in:
`~/.config/systemd/user/blackstory-overnight-enrichment.service.d/override.conf`.

## Failure handling

- Wikimedia **429/5xx**: exponential backoff + per-query isolation (failed query does not
  abort the round).
- OpenRouter empty/non-JSON or rate limit: hybrid provider fails over to Ollama.
- Single-subject LLM failure: `needs_evidence` packet + `error` field; other subjects continue.
- systemd: `Restart=on-failure` with burst limit on the unit.

## Related

- Daily SearXNG-only timer: `blackstory-discovery-web-search.timer` (08:30 UTC)
- Operator CLI providers: `packages/operator-cli/src/llm-provider.ts`
- Dev Guides: `~/Developer/Guides/CLI-Reference.md`, `Workflows.md`, `Secrets-1Password.md`
- Beads: `repo-6nr7` (overnight hybrid), `repo-rzlg` (raise discovery yield toward 1k)
