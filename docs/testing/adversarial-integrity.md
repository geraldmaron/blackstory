# Adversarial integrity testing

Repo-side red-team scenarios for data-integrity attacks. **No live attacks** against production or staging endpoints.

## Run

```bash
pnpm --filter @repo/testing test:security
# or:
node --import tsx scripts/run-testing-layer.mjs security
```

Module: `packages/testing/src/adversarial-integrity/`

## Scenarios

| ID | Attack pattern | Primary controls |
|----|----------------|------------------|
| `false_source_submissions` | Fabricated sources / low-trust leads |  quarantine;  promotion gate |
| `source_laundering` | Shared-registrant mirror blogs |  Sybil collapse; top-tier source gate |
| `coordinated_citation_repetition` | Citation ring volume |  lineage collapse; promotion gate |
| `altered_documents` | Duplicate fingerprints + contradictions |  duplicate detection; promotion gate |
| `misidentified_people` | Weak entity-match confidence |  confidence threshold |
| `living_address_attempts` | Living-person street addresses |  redaction; public serialization |
| `procedural_status_inflation` | Convicted language on alleged evidence |  public-language gate |
| `race_inference` | Identity-attribute framing |  identity framing guard; quarantine |
| `relevance_gaming` | Skip relevance → publication |  state machine;  promotion |
| `moderator_social_engineering` | Self-approval / mass assignment / lone reviewer |  approver conflict;  schema;  consensus |
| `unauthorized_publication` | Direct publish / stage skip |  publication gate;  stage order; top-tier gate |

## Acceptance criteria

1. **False submissions cannot directly change public content** — every scenario sets `publicContentMutated: false` and blocks the attack path.
2. **Lineage detection prevents volume-based confidence inflation** — coordinated/laundering scenarios assert collapsed independent lineage counts.
3. **High-impact language remains constrained** — procedural inflation and identity-framing scenarios fail closed on public language.
4. **Gaps** — `DOCUMENTED_CONTROL_GAPS` in the harness is empty; existing controls held. File `bd create` remediation beads only when a scenario exposes a real gap.

## Parent wiring

- Export barrel: `packages/testing/src/adversarial-integrity/index.ts`
- Package root barrel: `export * from './adversarial-integrity/index.js'` in `packages/testing/src/index.ts`
- Security test layer: `scripts/run-testing-layer.mjs` includes `adversarial-integrity/**/*.test.ts`
- Dependencies: `@repo/security` and `@repo/domain` devDependencies on `@repo/testing`
