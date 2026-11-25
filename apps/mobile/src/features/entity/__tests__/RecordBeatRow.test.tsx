/**
 * RecordBeatRow: label beside the value at ordinary text sizes, above it at large type.
 */
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { recordBeatLabelColumnWidth, RecordBeatRow } from '../RecordBeatRow';
import { resetTestWindowSize, setTestWindowSize } from '@/ui/layout/testing';

describe('RecordBeatRow', () => {
  afterEach(resetTestWindowSize);

  it('stacks the label above the value at large type, and follows a live change', async () => {
    setTestWindowSize({ width: 402, height: 874, fontScale: 1 });
    const { getByTestId } = await render(
      <RecordBeatRow label="Coverage" value="Partial" testID="row" labelTestID="label" />,
    );
    expect(StyleSheet.flatten(getByTestId('row').props.style).flexDirection).toBe('row');
    expect(StyleSheet.flatten(getByTestId('label').props.style).width).toBe(
      recordBeatLabelColumnWidth,
    );

    await act(async () => setTestWindowSize({ width: 402, height: 874, fontScale: 1.5 }));
    // No flexDirection is a column: the label sits above the value, with no fixed column width.
    expect(StyleSheet.flatten(getByTestId('row').props.style).flexDirection).toBeUndefined();
    expect(StyleSheet.flatten(getByTestId('label').props.style).width).toBeUndefined();
  });
});
