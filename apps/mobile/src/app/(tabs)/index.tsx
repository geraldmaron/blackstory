/**
 * The app's root address. A first launch goes to the opening; every later one goes to the
 * Archive tab, so the app never has a distinct, undocumented "home" URL.
 *
 * Only this route checks. A deep link to anywhere else opens that place, opening seen or not.
 * If the marker cannot be read, the reader goes to the Archive: the opening must never be a
 * gate.
 */
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { hasSeenOpening } from '@/features/opening';

export default function TabIndexRedirect() {
  const [seen, setSeen] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    hasSeenOpening().then(setSeen, () => setSeen(true));
  }, []);
  if (seen === undefined) return null;
  return <Redirect href={seen ? '/archive' : '/opening'} />;
}
