import { render } from '@testing-library/react-native';
import { EntityMark } from '../EntityMark';

describe('EntityMark', () => {
  it('exposes an accessible name naming the entity and the reason no image is shown', async () => {
    const { getByRole } = await render(<EntityMark entityName="Ida B. Wells" reason="absent" />);
    const mark = getByRole('image');
    expect(mark.props.accessibilityLabel).toContain('Ida B. Wells');
    expect(mark.props.accessibilityLabel).toContain('No image available');
  });

  it('includes the kind label when provided', async () => {
    const { getByRole } = await render(
      <EntityMark entityName="Freedmen's Bureau" kindLabel="Organization" reason="pending-rights-review" />,
    );
    const mark = getByRole('image');
    expect(mark.props.accessibilityLabel).toContain('Organization');
    expect(mark.props.accessibilityLabel).toContain('pending rights review');
  });

  it.each(['book', 'pin', 'arch'] as const)('renders the %s shape variant without crashing', async (shape) => {
    const { getByRole } = await render(<EntityMark entityName="Test Entity" shape={shape} />);
    expect(getByRole('image')).toBeTruthy();
  });
});
