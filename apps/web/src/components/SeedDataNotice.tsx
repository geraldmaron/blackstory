/**
 * Reusable notice that sample/seed data is not a live public release.
 */

import { Notice } from '@repo/ui';

export type SeedDataNoticeProps = {
  readonly compact?: boolean;
};

export function SeedDataNotice({ compact = false }: SeedDataNoticeProps) {
  return (
    <Notice tone="warning" title="Sample seed data">
      {compact
        ? 'This view reads local fixtures, not live public projections (live projections pending).'
        : 'Blap is showing emulator/seed fixtures for UI demonstration. These records are not a production release and must not be treated as verified live research output.'}
    </Notice>
  );
}
