# Generated SQL Connect Admin SDKs

Produced by:

```bash
pnpm db:sql-connect:compile
# optional alias:
pnpm db:sql-connect:sdk
```

Outputs land in `generated/{public-read,submissions,admin,publication}/`.
They are gitignored; regenerate after connector/schema changes.
Do not add browser client SDK outputs. Cloud SQL link (`cloudLinked`) remains false until
`firebase dataconnect:sql:setup` against `black-book-efaaf`.
