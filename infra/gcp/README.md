# Optional GCP service controls

The application uses Vercel, Supabase Postgres, Supabase Auth, and Supabase Storage.
GCP is not a product database, authentication provider, hosting target, or scheduler.

The remaining Armor and cost-control files describe optional controls for a separately
provisioned API deployment. They are not evidence that those services exist. No deployment
or schedule is installed by this repository. Do not recreate the retired Firebase or
multi-project database topology.

See [architecture](../../docs/architecture.md) for the current system boundary. Removing
configuration does not delete cloud resources or prove that billing has stopped.
