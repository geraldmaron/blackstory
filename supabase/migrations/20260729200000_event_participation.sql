-- Event-participation junction (CIDOC-CRM E5/P11 pattern; Enslaved.org Role/Status model).
-- Links people, organizations, and places to events with evidence-backed roles.
-- status_at_event stays NULL when unknown — never guessed.

CREATE TABLE bb_canonical.event_participation (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES bb_canonical.entities (id) ON DELETE CASCADE,
  participant_id text NOT NULL REFERENCES bb_canonical.entities (id) ON DELETE CASCADE,
  role text NOT NULL,
  status_at_event text,
  valid_edtf text,
  evidence_ids text[] NOT NULL DEFAULT '{}',
  claim_ids text[] NOT NULL DEFAULT '{}',
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_id <> participant_id)
);

COMMENT ON TABLE bb_canonical.event_participation IS
  'CIDOC-CRM-style event junction: who/what participated in an event, with role and optional '
  'status-at-event. status_at_event is NULL when not attested (Enslaved.org rule).';

COMMENT ON COLUMN bb_canonical.event_participation.status_at_event IS
  'Role-specific status at the time of the event (e.g. enslaved, free). NULL when unknown — '
  'never inferred.';

CREATE UNIQUE INDEX event_participation_event_participant_role_uidx
  ON bb_canonical.event_participation (event_id, participant_id, role);

CREATE INDEX event_participation_event_id_idx
  ON bb_canonical.event_participation (event_id);

CREATE INDEX event_participation_participant_id_idx
  ON bb_canonical.event_participation (participant_id);

CREATE INDEX event_participation_role_idx
  ON bb_canonical.event_participation (role);
