import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ExhibitFrame, exhibitLabel } from '../ExhibitFrame';
import { EvidenceGrade, Receipt } from '../Receipt';

const object = <Text>object</Text>;

describe('ExhibitFrame', () => {
  it('labels the kind and what the year means, in words a screen reader can say', async () => {
    const { getByTestId } = await render(
      <ExhibitFrame kind="photograph" basis="date not on record">
        {object}
      </ExhibitFrame>,
    );
    const label = getByTestId('exhibit-label');
    expect(label.props.children).toBe('Photograph · date not on record');
    expect(label.props.accessibilityLabel).toBe('Photograph, date not on record.');
  });

  it('full has a label, crop marks and its receipt', async () => {
    const { getByTestId, getByText } = await render(
      <ExhibitFrame kind="document" receipt={<Receipt source="Library of Congress" />}>
        {object}
      </ExhibitFrame>,
    );
    expect(getByTestId('exhibit-label')).toBeTruthy();
    expect(getByTestId('exhibit-crop-marks', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('exhibit-receipt')).toBeTruthy();
    expect(getByText('Library of Congress')).toBeTruthy();
  });

  it('compact keeps the marks and drops the label', async () => {
    const { queryByTestId } = await render(
      <ExhibitFrame kind="photograph" variant="compact">
        {object}
      </ExhibitFrame>,
    );
    expect(queryByTestId('exhibit-label')).toBeNull();
    expect(queryByTestId('exhibit-crop-marks', { includeHiddenElements: true })).toBeTruthy();
  });

  it('quiet has no crop marks', async () => {
    const { queryByTestId, getByTestId } = await render(
      <ExhibitFrame kind="map" basis="city precision" variant="quiet">
        {object}
      </ExhibitFrame>,
    );
    expect(queryByTestId('exhibit-crop-marks', { includeHiddenElements: true })).toBeNull();
    expect(getByTestId('exhibit-label')).toBeTruthy();
  });

  it('a painting can replace the kind word', () => {
    expect(exhibitLabel('photograph', '1904', 'Painting')).toBe('Painting · 1904');
  });
});

describe('Receipt', () => {
  it('links a source and says the grade in words, never a letter', async () => {
    const { getByRole, getByLabelText, queryByText } = await render(
      <Receipt
        source="National Register of Historic Places"
        href="https://example.org/nrhp"
        detail="National Park Service"
        grade={<EvidenceGrade tier="high" />}
      />,
    );
    expect(getByRole('link').props.accessibilityLabel).toBe(
      'Source: National Register of Historic Places',
    );
    expect(getByLabelText('Evidence: Well evidenced')).toBeTruthy();
    expect(queryByText(/^[ABC]$/)).toBeNull();
  });

  it('prints a credit as text when there is nowhere to send the reader', async () => {
    const { getByText, queryByRole } = await render(<Receipt source="Ebyabe · CC BY-SA 3.0" />);
    expect(getByText('Ebyabe · CC BY-SA 3.0')).toBeTruthy();
    expect(queryByRole('link')).toBeNull();
  });
});
