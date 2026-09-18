# Operating a research run

Start with [the research framework](../research/README.md), then use
[research operations](../research/research-operations.md) for exact commands, flags, credentials
and dry-run behavior. Those are the authoritative research entry points for any agent or worker.

Use `bd` for work tracking. Keep credentials outside source control and logs. Review the target
database and cost budget before a committed run. Research writes are private proposals;
publication has separate authorization. Durable manifests, attempts and artifacts carry state
across processes. A chat session is not the execution ledger.

No host-specific launcher or active schedule is required. Do not install either during a run.
