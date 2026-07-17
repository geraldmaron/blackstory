# Launch gate CI (BB-063)

Optional, **non-blocking** workflow that runs the beta launch gate evaluator without human attestations. Expect **NO_GO** until an operator supplies attestations for a real launch.

```bash
node scripts/launch/evaluate-beta-gate.mjs --evaluator github-actions
```

Required gates for production GO must be attested separately before deploy approval.
