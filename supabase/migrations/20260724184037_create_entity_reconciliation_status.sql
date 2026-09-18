create table if not exists bb_canonical.entity_reconciliation_status (
  entity_id text primary key references bb_canonical.entities(id) on delete cascade,
  status text not null check (status in ('matched', 'no_match', 'ambiguous')),
  note text,
  checked_at timestamptz not null default now()
);

comment on table bb_canonical.entity_reconciliation_status is
  'Per-entity Wikidata reconciliation outcome (repo-xez5.3). Exists because entity_identifiers has a UNIQUE(namespace, value) constraint that cannot represent a no-match/ambiguous marker per entity. matched rows also have corresponding bb_canonical.entity_identifiers rows; no_match/ambiguous rows do not.';
