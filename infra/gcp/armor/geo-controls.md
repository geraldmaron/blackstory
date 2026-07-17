# Geographic controls — default OFF (BB-023)

**Policy:** Geographic IP restrictions are **disabled by default**. Enable only when
abuse telemetry or incident evidence justifies blocking specific regions or countries.

## Default posture

| Control | Value |
|---------|-------|
| `geoControls.enabled` | `false` |
| Armor rule priority 900 | `preview: true`, match `false` (never evaluates) |
| Default action | Allow all regions |

Source: [`ingress-matrix.json`](./ingress-matrix.json).

## When to enable

Turn on geographic controls only after **all** of the following:

1. **Evidence** — Sustained abusive traffic from identifiable region(s) that Armor
   rate limits and WAF rules do not contain (document in incident ticket / BB-034).
2. **Impact assessment** — Legitimate users in affected regions are negligible for the
   public research mission, or alternate access (e.g. VPN policy) is documented.
3. **Approval** — Security owner sign-off recorded in Beads / incident log.
4. **Rollback plan** — One-command disable documented below.

Do **not** enable geo blocks preemptively for compliance theater or "US-only" defaults
without data.

## Activation pattern (human apply)

Replace `false` with a region expression at priority 900 on the relevant policy:

```text
# Example: deny traffic sourced from ASNs associated with a documented abuse campaign
origin.region_code == 'XX' && inIpRange(origin.ip, '203.0.113.0/8')
```

Steps:

1. Set rule 900 `preview=false`.
2. Update `match.expr.expression` to the approved CEL expression.
3. Set `action` to `deny(403)`.
4. Monitor `backend_request_count` and support channels for false positives.

## Deactivation

```bash
gcloud compute security-policies rules update 900 \
  --security-policy=black-book-api-public-armor \
  --expression="false" \
  --action=allow \
  --preview \
  --project=black-book-efaaf
```

Repeat for `black-book-api-submissions-armor` if both were enabled.

## Documentation requirement

When enabling geo controls, append a row to the incident / decision log with:

- Date and bead or ticket ID
- Regions or expressions blocked
- Metrics that justified the change
- Review date for removal

## Related threats

- T-01 (volumetric DoS) — prefer rate limits and CDN first
- T-19 (scraping) — prefer per-IP rate bans before country blocks
