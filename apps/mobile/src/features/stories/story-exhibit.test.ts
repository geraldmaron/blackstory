import { isQuietImage, storyImageBasis, storyImageKind } from './story-exhibit';

describe('story image labels say no more than the image does', () => {
  it('names a photograph or a document only when its own words do', () => {
    expect(storyImageKind({ alt: 'Photograph of a schoolhouse', credit: 'LOC' })).toBe(
      'photograph',
    );
    expect(storyImageKind({ alt: 'A census schedule page', credit: 'NARA' })).toBe('document');
    expect(storyImageKind({ alt: 'Portrait, oil painting', credit: 'NPG' })).toBeUndefined();
    expect(storyImageKind({ alt: 'A man at a desk', credit: 'LOC' })).toBeUndefined();
  });

  it('claims a date only when the credit states one', () => {
    expect(storyImageBasis({ alt: 'x', credit: 'Mathew Brady, 1864, LOC' })).toBe(
      'date in the credit',
    );
    expect(storyImageBasis({ alt: 'taken in 1864', credit: 'LOC' })).toBe('date not on record');
  });

  it('quiets an image whose words name a massacre, plantation or lynching', () => {
    expect(isQuietImage({ alt: 'Postcard of the Tulsa massacre', credit: 'LOC' })).toBe(true);
    expect(isQuietImage({ alt: 'A lynching', credit: 'LOC' })).toBe(true);
    expect(isQuietImage({ alt: 'A schoolhouse', credit: 'LOC' })).toBe(false);
  });
});
