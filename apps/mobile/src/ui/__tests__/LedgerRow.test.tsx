/**
 * LedgerRow — the hint a row carries when it leaves the app (More web rows, citation rows).
 */
import { render } from '@testing-library/react-native';

import { EXTERNAL_LINK_HINT } from '../Link';
import { LedgerRow } from '../LedgerRow';

describe('LedgerRow', () => {
  it('passes an accessibility hint through to the pressable row', async () => {
    const { getByRole } = await render(
      <LedgerRow title="Support" onPress={() => {}} accessibilityHint={EXTERNAL_LINK_HINT} />,
    );
    expect(getByRole('button').props.accessibilityHint).toBe(EXTERNAL_LINK_HINT);
  });

  it('sets no hint when none is given', async () => {
    const { getByRole } = await render(<LedgerRow title="About" onPress={() => {}} />);
    expect(getByRole('button').props.accessibilityHint).toBeUndefined();
  });
});
