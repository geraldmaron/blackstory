# MOB-005 release activation evidence

Deterministic fixtures produced by `src/publication/release-evidence.test.ts` from
`generateReleaseArtifacts` + in-memory activation drill. Regenerate when bootstrap or artifact
kinds change intentionally:

```bash
UPDATE_RELEASE_EVIDENCE=1 pnpm --filter @repo/domain test src/publication/release-evidence.test.ts
```

| File | Contents |
|------|----------|
| `manifests/rel_mob005_a.json` | Bootstrap manifest sample (release A) |
| `manifests/rel_mob005_b.json` | Bootstrap manifest sample (release B) |
| `size-report.json` | Raw + gzip byte counts per artifact kind |
| `activation-log.json` | Activate A → B → rollback A steps |
| `failure-injection.json` | Corrupted artifact rejection + one-deep GC |

Postgres SoR persistence is covered by `@repo/data-access` release-store tests; GCS blob upload
and live Supabase rows remain operator/launch-gate deferred (MOB-021).
