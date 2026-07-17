# Emergency deny runbook (BB-023)

Activate a **global deny** at Cloud Armor priority **10** without redeploying application
code or Cloud Run revisions. Rule 10 is pre-provisioned in both policies with default
`action: allow`.

**Policies:** `black-book-api-public-armor`, `black-book-api-submissions-armor`  
**Snippet:** [`policies/emergency-deny-snippet.yaml`](./policies/emergency-deny-snippet.yaml)

## When to use

- Active exploitation bypassing WAF and rate limits
- Coordinated abuse campaign requiring immediate traffic cutover
- Compromised API key or App Check bypass at scale (until BB-024 rotation completes)

Prefer **scoped blocks** (priority 15, single CIDR) when abuse source is known.

## Activate — block all traffic on one API

```bash
PROJECT=black-book-efaaf
POLICY=black-book-api-public-armor   # or black-book-api-submissions-armor

gcloud compute security-policies rules update 10 \
  --security-policy="${POLICY}" \
  --action=deny-403 \
  --project="${PROJECT}"
```

Propagate time is typically **under 60 seconds** globally. No Cloud Run deploy required.

## Activate — block both public APIs

Run the command above for **both** policies, or use the paired commands in
`emergency-deny-snippet.yaml`.

## Deactivate — restore service

```bash
gcloud compute security-policies rules update 10 \
  --security-policy="${POLICY}" \
  --action=allow \
  --project="${PROJECT}"
```

Verify with LB hostname health check before closing the incident.

## Scoped block (optional, priority 15)

```bash
gcloud compute security-policies rules create 15 \
  --security-policy="${POLICY}" \
  --expression="inIpRange(origin.ip, '203.0.113.0/24')" \
  --action=deny-403 \
  --project="${PROJECT}"
```

Remove when incident ends:

```bash
gcloud compute security-policies rules delete 15 \
  --security-policy="${POLICY}" \
  --project="${PROJECT}"
```

## Verification

| Step | Expected |
|------|----------|
| `curl -I https://api.blackbook.app/health` after activate | HTTP 403 from edge |
| Cloud Monitoring | Spike in `backend_request_count` with `response_code=403` |
| Direct `run.app` URL | Still blocked (ingress unchanged) |
| After deactivate | HTTP 200 via LB hostname |

## Post-incident

1. Record timeline in Beads / incident log.
2. Review whether BB-025 app quotas or BB-034 alerts need tuning.
3. Confirm rule 10 returned to `allow` on both policies.

## Acceptance mapping

**AC-ARMOR-4:** `emergencyDeny.activateWithoutDeploy=true` in
[`ingress-matrix.json`](./ingress-matrix.json).
