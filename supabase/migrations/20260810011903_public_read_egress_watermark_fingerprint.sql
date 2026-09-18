alter table bb_ops.public_read_egress_watermark
  add column if not exists fingerprint text;

comment on column bb_ops.public_read_egress_watermark.fingerprint is
  'The LIKE pattern the stored counters were captured under. When the monitor edits a '
  'fingerprint, the previous counters describe a different set of statements and the delta '
  'between them is meaningless; comparing this column forces a re-baseline instead.';

truncate bb_ops.public_read_egress_watermark;
