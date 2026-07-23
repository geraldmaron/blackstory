/**
 * v6 edition fact strip primitives — label-over-value layout.
 */
import { render } from '@testing-library/react-native';
import { EditionFactCell, RecordFactStrip } from '@/ui';

describe('EditionFactCell', () => {
  it('renders uppercase mono label above editorial value', async () => {
    const { getByText } = await render(<EditionFactCell label="Era" value="1950s" />);
    expect(getByText('ERA')).toBeTruthy();
    expect(getByText('1950s')).toBeTruthy();
  });
});

describe('RecordFactStrip', () => {
  it('renders a grid of fact cells', async () => {
    const { getByText } = await render(
      <RecordFactStrip
        facts={[
          { key: 'kind', label: 'Kind', value: 'Person' },
          { key: 'era', label: 'Era', value: '1840s' },
        ]}
      />,
    );
    expect(getByText('KIND')).toBeTruthy();
    expect(getByText('Person')).toBeTruthy();
    expect(getByText('ERA')).toBeTruthy();
    expect(getByText('1840s')).toBeTruthy();
  });

  it('returns null when facts array is empty', async () => {
    const { toJSON } = await render(<RecordFactStrip facts={[]} />);
    expect(toJSON()).toBeNull();
  });
});
