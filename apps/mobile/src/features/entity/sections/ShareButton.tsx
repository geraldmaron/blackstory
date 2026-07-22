import { useState } from 'react';
import { Button } from '@/ui';
import { shareEntity } from '../share';

export type ShareButtonProps = {
  readonly entityId: string;
  readonly displayName: string;
};

export function ShareButton({ entityId, displayName }: ShareButtonProps) {
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    setBusy(true);
    try {
      await shareEntity(entityId, displayName);
    } finally {
      setBusy(false);
    }
  };

  return <Button label="Share" variant="secondary" loading={busy} onPress={handlePress} />;
}
