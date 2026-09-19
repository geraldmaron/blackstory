# Optional GCP deployment identity

Optional API workflows can use a separately provisioned GCP Workload Identity Federation
provider through `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT`. No trust pool is
provisioned by this repository. Research and the Vercel web deployment do not depend on it.

`../scripts/check-wif.sh` performs read-only inventory of an explicitly configured identity.
Use protected GitHub environments and short-lived credentials for authorized deployment jobs.
The environment JSON files describe desired policy; they are not proof of remote settings.
See [production release](../../../docs/runbooks/production-release.md) before dispatching work.
