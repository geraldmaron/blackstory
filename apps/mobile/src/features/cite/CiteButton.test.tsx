import { fireEvent, render } from '@testing-library/react-native';
import { Share } from 'react-native';

import { CiteButton } from './CiteButton';

const source = { title: 'The Count', url: 'https://blackstory.app/stories/the-count' };

describe('CiteButton', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders nothing by default: Cite is off', async () => {
    const { queryByTestId } = await render(<CiteButton source={source} />);
    expect(queryByTestId('cite-button')).toBeNull();
  });

  it('when on, opens the share sheet with the three citations', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const { getByLabelText } = await render(<CiteButton source={source} enabled />);
    await fireEvent.press(getByLabelText('Cite The Count'));
    expect(share).toHaveBeenCalledTimes(1);
    const message = share.mock.calls[0]![0] as { message: string };
    expect(message.message).toMatch(/^MLA\n"The Count\." BlackStory, https:\/\/blackstory\.app/);
    expect(message.message).toContain('\n\nAPA\n');
    expect(message.message).toContain('\n\nChicago\n');
  });
});
