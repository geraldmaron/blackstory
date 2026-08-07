import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  articleCorroboratesPlace,
  isDisambiguationExtract,
  searchQueryFromDisplayName,
} from './wikipedia.ts';

describe('isDisambiguationExtract', () => {
  it('recognizes a standard MediaWiki disambiguation opener', () => {
    assert.equal(
      isDisambiguationExtract(
        'Maplewood may refer to:\n\nUnited States\n\nMaplewood, Alabama\n...',
      ),
      true,
    );
  });

  it('is case-insensitive and tolerates a short subject phrase before "may refer to"', () => {
    assert.equal(
      isDisambiguationExtract('Springfield may refer to: Springfield, Illinois...'),
      true,
    );
  });

  it('does not flag ordinary prose that happens to contain "refer to" later in the text', () => {
    assert.equal(
      isDisambiguationExtract(
        "The Whitelaw Hotel opened in 1919. Residents would often refer to it as Black Broadway's anchor.",
      ),
      false,
    );
  });

  it('does not flag an article with a normal opening sentence', () => {
    assert.equal(
      isDisambiguationExtract(
        'Archie L. Edwards (1918-1998) was an American Piedmont blues guitarist.',
      ),
      false,
    );
  });
});

describe('articleCorroboratesPlace rejects disambiguation pages', () => {
  it('returns false for a disambiguation page even when it happens to name the target place', () => {
    const extract =
      'Maplewood may refer to:\n\nUnited States\n\nMaplewood, Jefferson County, Alabama\nMaplewood, California\n...';
    assert.equal(
      articleCorroboratesPlace(extract, { city: undefined, county: 'Jefferson', state: 'Alabama' }),
      false,
    );
  });

  it('still corroborates a real article mentioning the place', () => {
    const extract = 'The Whitelaw Hotel is a historic building in Washington, D.C.';
    assert.equal(
      articleCorroboratesPlace(extract, {
        city: 'Washington',
        county: undefined,
        state: undefined,
      }),
      true,
    );
  });
});

describe('searchQueryFromDisplayName', () => {
  it('un-inverts a filing-style "Type, First, Last" name', () => {
    assert.equal(searchQueryFromDisplayName('Jude, George, House'), 'George Jude House');
  });
});
