# Adversarial integrity testing (BB-060)

Repo-side red-team scenarios for data-integrity attacks. **No live attacks** against production or staging endpoints.

## Run

```bash
pnpm --filter @black-book/testing test:security
# or:
node --import tsx scripts/run-testing-layer.mjs security
```

Module: `packages/testing/src/adversarial-integrity/`

## Scenarios

| ID | Attack pattern | Primary controls |
|----|----------------|------------------|
| `false_source_submissions` | Fabricated sources / low-trust leads | BB-029 quarantine; BB-032 promotion gate |
| `source_laundering` | Shared-registrant mirror blogs | BB-043 Sybil collapse; top-tier source gate |
| `coordinated_citation_repetition` | Citation ring volume | BB-032 lineage collapse; promotion gate |
| `altered_documents` | Duplicate fingerprints + contradictions | BB-032 duplicate detection; promotion gate |
| `misidentified_people` | Weak entity-match confidence | BB-043 confidence threshold |
| `living_address_attempts` | Living-person street addresses | BB-015 redaction; public serialization |
| `procedural_status_inflation` | Convicted language on alleged evidence | BB-043 public-language gate |
| `race_inference` | Identity-attribute framing | BB-095 identity framing guard; quarantine |
| `relevance_gaming` | Skip relevance → publication | BB-044 state machine; BB-032 promotion |
| `moderator_social_engineering` | Self-approval / mass assignment / lone reviewer | BB-032 approver conflict; BB-029 schema; BB-076 consensus |
| `unauthorized_publication` | Direct publish / stage skip | BB-044 publication gate; BB-032 stage order; top-tier gate |

## Acceptance criteria

1. **False submissions cannot directly change public content** — every scenario sets `publicContentMutated: false` and blocks the attack path.
2. **Lineage detection prevents volume-based confidence inflation** — coordinated/laundering scenarios assert collapsed independent lineage counts.
3. **High-impact language remains constrained** — procedural inflation and identity-framing scenarios fail closed on public language.
4. **Gaps** — `DOCUMENTED_CONTROL_GAPS` in the harness is empty; existing controls held. File `bd create` remediation beads only when a scenario exposes a real gap.

## Parent wiring

- Export barrel: `packages/testing/src/adversarial-integrity/index.ts`
- Package root barrel: `export * from './adversarial-integrity/index.js'` in `packages/testing/src/index.ts`
- Security test layer: `scripts/run-testing-layer.mjs` includes `adversarial-integrity/**/*.test.ts`
- Dependencies: `@black-book/security` and `@black-book/domain` devDependencies on `@black-book/testing`
