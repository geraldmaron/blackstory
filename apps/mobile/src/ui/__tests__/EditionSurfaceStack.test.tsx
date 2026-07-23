/**
 * EditionSurfaceStack — browse panel vertical gap and dense mode.
 */
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { EditionSurfaceStack } from '../EditionSurfaceStack';

describe('EditionSurfaceStack', () => {
  it('renders stacked children', async () => {
    const { getByText } = await render(
      <EditionSurfaceStack>
        <Text>Panel one</Text>
        <Text>Panel two</Text>
      </EditionSurfaceStack>,
    );

    expect(getByText('Panel one')).toBeTruthy();
    expect(getByText('Panel two')).toBeTruthy();
  });

  it('renders dense stack without throwing', async () => {
    const { getByText } = await render(
      <EditionSurfaceStack dense>
        <Text>Dense panel</Text>
      </EditionSurfaceStack>,
    );

    expect(getByText('Dense panel')).toBeTruthy();
  });
});
