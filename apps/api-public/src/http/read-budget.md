# Public read costs

Public readers use Postgres projections and release artifacts. Query/result bounds and cache
behavior are specified in their implementation and tests. Per-request database latency, rows
scanned, bytes returned and cache hit rate must be measured against representative releases.

No measured production read-price estimate is asserted here. Use `EXPLAIN (ANALYZE, BUFFERS)`
on an isolated representative database and endpoint measurements before changing limits. Count
vector-provider calls separately from database reads. A denied request can still incur ingress,
process, cache, or logging work; never describe it as free without measurement.
