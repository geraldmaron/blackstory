# Focused production fixes

Keep the fix narrowly scoped and use a single reviewed PR. Follow
[production release](production-release.md): merging to the configured production branch can
immediately deploy both public web and admin through Vercel Git integration.

1. Reproduce the failure and identify its cause before editing.
2. Add a meaningful regression check and run the applicable local CI lanes.
3. Inspect the complete PR diff. Do not include unrelated branch work in a production fix.
4. Verify the matching database schema and application revision before deployment.
5. After deployment, inspect the real affected surface, public-data freshness and error telemetry.
6. Close the issue with observed evidence. If the release fails, use the documented rollback.

Keep lockfiles aligned with dependencies. Do not bypass failing required checks, restore retired
providers, or substitute seed data for failed live reads. A successful build alone is not proof
that the affected runtime path works.
