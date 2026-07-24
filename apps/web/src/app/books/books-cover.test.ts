/**
 * Open Library cover URL helpers for banned-books browse and detail surfaces.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverInitialsForTitle, coverIsbnForBook, openLibraryCoverUrl } from './books-cover';

test('coverIsbnForBook prefers isbn-13 over isbn-10', () => {
  assert.equal(
    coverIsbnForBook({
      identifiers: [
        { system: 'isbn-10', value: '0307278441' },
        { system: 'isbn-13', value: '9780307278449' },
      ],
    }),
    '9780307278449',
  );
});

test('openLibraryCoverUrl builds ISBN cover path with fail-closed default', () => {
  assert.equal(
    openLibraryCoverUrl('9780307278449', 'M'),
    'https://covers.openlibrary.org/b/isbn/9780307278449-M.jpg?default=false',
  );
});

test('coverInitialsForTitle returns up to two initials', () => {
  assert.equal(coverInitialsForTitle('The Bluest Eye'), 'TB');
  assert.equal(coverInitialsForTitle('Beloved'), 'BE');
});
