# Administrator identity and authorization

The admin console runs under `/admin` in the web application. Supabase Auth verifies staff
sessions. Server routes resolve the user through `auth.getUser`, require an email, and read
exactly one role from trusted `app_metadata.app_role`. User-editable metadata never grants access.

`apps/web/src/admin/auth/request-auth.ts` applies the route policy in `route-permissions.ts`.
Undeclared routes fail closed. Server writes use the shared permissions in `staff-permissions.ts`;
client-side controls only hide unavailable actions and cannot authorize them.

| Role | Permissions |
|---|---|
| `research` | Research proposals and canonical record edits |
| `publication` | Publish and retract |
| `security` | Rights changes and privileged exports |
| `admin` | All declared permissions, including merge, bulk changes, policy, and roles |

There is no Firebase identity, IAP principal, boolean-role fallback, or multiple-role claim.
Role administration uses trusted Supabase administrative operations; there is no public role-write
endpoint. Database RLS is a separate control and must agree with the application's role vocabulary.
The schema cutover migration changes both the database role reader and stored app metadata.

The current route authorizer does not enforce MFA assurance level or recent reauthentication.
Do not claim those controls from provider availability or a design document. Adding either requires
an explicit policy, server enforcement, and tests for expired and insufficient-assurance sessions.

Validation: admin request, route-permission, staff-permission, and Supabase-session tests exercise
invalid tokens, missing roles, forbidden roles, and routes absent from the policy. Session cookies
and service credentials must never appear in research evidence, logs, or public bundles.
