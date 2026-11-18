import assert from 'node:assert/strict';
import { test } from 'node:test';
import { uninvertFiledName, uninvertLeadingArticle } from './uninvert-leading-article.ts';

test('moves a trailing article to the front', () => {
  assert.equal(uninvertLeadingArticle("Women's Building, The"), "The Women's Building");
  assert.equal(uninvertLeadingArticle('Omaha Star, the'), 'The Omaha Star');
  assert.equal(uninvertLeadingArticle('Grange, A'), 'A Grange');
});

test('leaves other names alone', () => {
  assert.equal(uninvertLeadingArticle('Smith, John, House'), 'Smith, John, House');
  assert.equal(uninvertLeadingArticle('The Grange'), 'The Grange');
  assert.equal(uninvertLeadingArticle('Hotel Theresa'), 'Hotel Theresa');
});

test('puts a filed person name in reading order', () => {
  const cases: Record<string, string> = {
    'Evers, Medgar, House': 'Medgar Evers House',
    'Attucks, Crispus, High School': 'Crispus Attucks High School',
    'Clemens, James and Sophia, Farmstead': 'James and Sophia Clemens Farmstead',
    'King, Martin Luther, Jr., Historic District': 'Martin Luther King Jr. Historic District',
    'Gardner, Isaac Sr., House': 'Isaac Gardner Sr. House',
    'Hardin, R.F.,High School': 'R.F. Hardin High School',
    'Ellington, Edward Kennedy "Duke", House': 'Edward Kennedy "Duke" Ellington House',
    "Women's Building, The": "The Women's Building",
  };
  for (const [filed, read] of Object.entries(cases)) assert.equal(uninvertFiledName(filed), read);
});

test('leaves names that are not surname, given name, type alone', () => {
  for (const name of [
    'Bethel Baptist Church, Parsonage, and Guardhouse',
    'Fort Hill and Butterfield, Archibald D., House',
    'Whipper, Elliott, and Allen',
    'Anderson, Eddie "Rochester," House',
    'Youth Pride, Inc. (aka Pride, Inc.)',
    'Richardson, L., Memorial Hospital, Former',
    'Pennsylvania Constitution of 1838, Article III, Section 1',
    'Mayersville, Mississippi',
    'Hotel Theresa',
  ])
    assert.equal(uninvertFiledName(name), name);
});
