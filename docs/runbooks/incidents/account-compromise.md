# Account compromise

Investigate unexpected role changes, MFA/session anomalies and unauthorized publication actions.
Record the account, affected sessions, actions and earliest confirmed compromise time.

1. Revoke the account's Supabase sessions and remove compromised application-role grants.
   Existing access tokens can remain valid until expiry; sensitive operations must be blocked
   during containment. Do not rely on user deletion alone.
2. Pause publication and affected writers. Preserve independent service identities and audit data.
3. Review accepted changes and activated releases. Restore a verified release when necessary.
4. Reset MFA from a trusted device, rotate exposed secrets, and verify a clean-session canary.
5. Assess required user or regulatory notifications with the responsible operator.

Use [database compromise](database-compromise.md) if canonical records or authorization policy
were changed. Recovery requires observed evidence, not only successful authentication.
