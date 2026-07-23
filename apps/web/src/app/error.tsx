/**
 * Segment error boundary for public routes. v6 utility edition with design-system Notice.
 */

'use client';

import '../components/patterns/utility-edition/utility-edition.css';
import { UtilityEditionErrorView } from '../components/patterns/utility-edition/UtilityEditionErrorView';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <UtilityEditionErrorView error={error} reset={reset} />;
}
