import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  articleCorroboratesSubject,
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

describe('articleCorroboratesSubject', () => {
  it('returns false for a disambiguation page even when it happens to name the target place', () => {
    const extract =
      'Maplewood may refer to:\n\nUnited States\n\nMaplewood, Jefferson County, Alabama\nMaplewood, California\n...';
    assert.equal(
      articleCorroboratesSubject(extract, 'Maplewood', {
        displayName: 'Maplewood',
        city: undefined,
        county: 'Jefferson',
        state: 'Alabama',
      }).corroborated,
      false,
    );
  });

  it('corroborates a real article about the subject in the right place', () => {
    const extract =
      'The Whitelaw Hotel is a historic building in Washington, D.C. Built in 1919 by John ' +
      'Whitelaw Lewis, the Whitelaw was the first luxury hotel in the city built for and by ' +
      'African Americans.';
    assert.equal(
      articleCorroboratesSubject(extract, 'Whitelaw Hotel', {
        displayName: 'Whitelaw Hotel',
        city: 'Washington',
        county: undefined,
        state: 'District of Columbia',
      }).corroborated,
      true,
    );
  });

  // repo-ppeu, the case that named the bead: search returns the same city name in a different
  // state, and the article corroborates "Covington" perfectly.
  it('refuses the same city name in the wrong state', () => {
    const extract =
      'Covington is a home rule-class city in Kenton County, Kentucky, United States, at the ' +
      'confluence of the Ohio and Licking rivers.';
    assert.equal(
      articleCorroboratesSubject(extract, 'Covington, Kentucky', {
        displayName: 'First Baptist Church',
        city: 'Covington',
        county: 'Alleghany',
        state: 'Virginia',
      }).corroborated,
      false,
    );
  });
});

describe('searchQueryFromDisplayName', () => {
  it('un-inverts a filing-style "Type, First, Last" name', () => {
    assert.equal(searchQueryFromDisplayName('Jude, George, House'), 'George Jude House');
  });
});
