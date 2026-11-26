import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nrhpRegistryRowUrl,
  parseNrhpRegistryRowUrl,
  renderNrhpRegistryRows,
} from './nrhp-registry-row.js';

test('a registry row URL is the nps.gov dataset plus a reference number, and nothing else', () => {
  const url = nrhpRegistryRowUrl('100012511');
  assert.deepEqual(parseNrhpRegistryRowUrl(url), {
    datasetUrl:
      'https://www.nps.gov/subjects/nationalregister/upload/national-register-listed_20260522.xlsx',
    refnum: '100012511',
  });
  for (const other of [
    url.replace('www.nps.gov', 'www.nps.gov.evil.example'),
    url.replace('https:', 'http:'),
    url.replace('?refnum=100012511', ''),
    `${url}#x`,
    url.replace('national-register-listed', '../other'),
    'https://npgallery.nps.gov/AssetDetail/NRIS/100012511',
    'not a url',
  ]) {
    assert.equal(parseNrhpRegistryRowUrl(other), undefined, other);
  }
});

test('rows render as labeled lines with dates spelled out and restricted addresses left out', () => {
  const header = {
    A: 'Ref#',
    B: 'Property Name',
    C: 'Street & Number',
    D: 'Restricted Address',
    E: 'Area of Significance',
    F: 'Listed Date',
  };
  const rows = [
    {
      A: '1',
      B: 'Open Place',
      C: '12 Main St.',
      D: '0',
      E: ' ETHNIC HERITAGE-BLACK',
      F: '46029.4',
    },
    { A: '2', B: 'Guarded Place', C: '9 Hidden Rd.', D: '1', F: '25975' },
  ];
  const open = renderNrhpRegistryRows(header, rows, '1')!;
  assert.match(open, /Ref#: 1\nProperty Name: Open Place\nStreet & Number: 12 Main St\./u);
  assert.match(open, /Area of Significance: ETHNIC HERITAGE-BLACK/u);
  assert.match(open, /Listed Date: 46029\.4 \(January 7, 2026\)/u);
  const guarded = renderNrhpRegistryRows(header, rows, '2')!;
  assert.doesNotMatch(guarded, /Hidden Rd/u);
  assert.match(guarded, /Listed Date: 25975 \(February 11, 1971\)/u);
  assert.equal(renderNrhpRegistryRows(header, rows, '3'), undefined);
});

test('only the NPS asset path gets the larger nomination PDF limit', async () => {
  const { isNpgalleryNomination } = await import('./nrhp-registry-row.ts');
  assert.equal(
    isNpgalleryNomination('https://npgallery.nps.gov/NRHP/GetAsset/NRHP/76002187_text'),
    true,
  );
  assert.equal(
    isNpgalleryNomination('https://npgallery.nps.gov.evil.example/NRHP/GetAsset/x'),
    false,
  );
  assert.equal(isNpgalleryNomination('https://npgallery.nps.gov/other/x'), false);
  assert.equal(isNpgalleryNomination('http://npgallery.nps.gov/NRHP/GetAsset/x'), false);
});
