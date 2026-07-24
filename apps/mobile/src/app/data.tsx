/**
 * Stack route for `/data` — national rollups and Phase 1 indicators (web `/data` parity).
 * Reliable stack back falls through to More when history is empty (deep link / cold start).
 */
import { DataScreen } from '@/features/data';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function DataRoute() {
  useEditionStackBack({
    fallbackHref: '/more',
    accessibilityHint: 'Returns to More when there is no previous screen',
  });
  return <DataScreen />;
}
