# Beta launch gate (BB-063)

Measurable, fail-closed **go/no-go** evaluation for public beta. Failed required gates block launch — they are not informal follow-ups.

## Run

```bash
node scripts/launch/evaluate-beta-gate.mjs \
  --evaluator "platform-oncall@example.com" \
  --attestations path/to/attestations.json \
  --output docs/launch/latest-beta-decision.json
```

Exit codes:

| Code | Meaning |
|------|---------|
| `0` | **GO** — all required gates passed |
| `1` | **NO_GO** — one or more required gates failed |
| `2` | CLI/config error |

## Human attestations

Human gates fail-closed until recorded in a JSON bundle:

```json
{
  "schemaVersion": 1,
  "attestations": [
    {
      "gateId": "published-claims-with-evidence",
      "attestedBy": "publication-operator@example.com",
      "attestedAt": "2026-07-17T12:00:00.000Z",
      "evidenceRef": "release-ticket-1234"
    }
  ]
}
```

Fixture with all required human gates: `packages/testing/src/launch-gate/fixtures/all-pass-attestations.json`.

## Machine gates

Machine gates assert repo evidence (files, docs, harness outputs) without live cloud apply:

| Gate | Evidence |
|------|----------|
| Gold corpus precision | After predictions pass thresholds |
| Restore rehearsal | BB-061 dry-run report + rollback script |
| Load/abuse | BB-059 scenario inventory |
| Adversarial integrity | BB-060 scenario inventory |
| Methodology/corrections | Public trust surfaces in `apps/web` |
| Disclaimers | BB-095 registry module |
| Release pipeline | BB-062 runbook + provenance schema |
| Beta disable path | Kill switches + App Hosting env + runbook |

## Disable public beta quickly

See [disable-public-beta.md](./disable-public-beta.md).

## Schema

Decision artifact schema: `infra/github/launch-gate/beta-launch-decision.schema.json`.

## Modules

| Path | Role |
|------|------|
| `packages/testing/src/launch-gate/` | Evaluation harness |
| `packages/config/src/launch-gate/` | Kill-switch config keys |
| `scripts/launch/evaluate-beta-gate.mjs` | CLI entry |
| `infra/github/launch-gate/` | Schema + optional CI workflow |

## Parent wiring

- Export barrel: `packages/testing/src/launch-gate/index.ts`
- Package root barrel: add `export * from './launch-gate/index.js'` in `packages/testing/src/index.ts`
- Config subpath: add `"./launch-gate"` export in `packages/config/package.json`
- Test layer: include `launch-gate/**/*.test.ts` in `scripts/run-testing-layer.mjs` `release-gates` matcher
- Optional CI: `infra/github/launch-gate/launch-gate.yml` (non-blocking)
