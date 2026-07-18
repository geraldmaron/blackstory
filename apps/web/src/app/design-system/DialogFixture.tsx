/**
 * Client-only dialog fixture used by the design-system gallery route.
 */

'use client';

import { useState } from 'react';
import { Button, Dialog } from '@blap/ui';

export function DialogFixture() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bp-stack">
      <Button type="button" onClick={() => setOpen(true)}>
        Open sample dialog
      </Button>
      <Dialog
        open={open}
        title="Why this appears"
        onClose={() => setOpen(false)}
        footer={
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <p>
          Dialogs use the native <code className="bp-mono">&lt;dialog&gt;</code> element for focus
          management, Escape to dismiss, and a labelled title.
        </p>
      </Dialog>
    </div>
  );
}
