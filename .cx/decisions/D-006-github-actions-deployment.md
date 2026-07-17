# D-006 — GitHub Actions deployment

CI/CD via GitHub Actions + OIDC/WIF. Deploy tested SHA only; protected prod approval; migrations before incompatible traffic; disable automatic App Hosting rollouts.

Formal: `docs/adr/ADR-006-github-actions-deployment.md`  
PR CI: `.github/workflows/ci.yml` (BB-008/009). OIDC stub: `.github/workflows/deploy-production.yml` (BB-010). WIF design: `infra/gcp/wif/` (not applied). Local governance under `infra/github/` (BB-009); remote rulesets not applied yet.
