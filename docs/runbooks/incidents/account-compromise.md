# Account compromise

## Trigger and triage

- Trigger on impossible travel, MFA/reset anomalies, unexpected IAP access, role changes, or publication actions.
- Identify the account, sessions, roles, actions, and earliest confirmed compromise time.

## Contain

1. Disable the account and revoke its Firebase/Auth/IAP sessions.
2. Engage `publication` and any feature switches the account could operate.
3. Remove only the compromised account's grants; preserve independent service identities.
4. If a release changed, execute the BB-019 prior-release rollback and verify hashes.

## Recover

- Reset MFA from a trusted device, review BB-018 and Cloud Audit Logs, and revert unauthorized grants/data.
- Re-enable least privilege only after security approval and a clean-session canary.
- Notify affected users and regulators when legal/privacy assessment requires it.
