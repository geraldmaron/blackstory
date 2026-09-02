import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNrhpCommonsImageRow,
  commonsFileTitleFromImageIri,
  parseNrhpImageSparqlResults,
  qidFromWikidataIri,
  summarizeNrhpCommonsImageRows,
  type NrhpCommonsImageRow,
} from './nrhp-commons-image-plan.ts';

test('qidFromWikidataIri extracts the QID from an entity IRI', () => {
  assert.equal(qidFromWikidataIri('http://www.wikidata.org/entity/Q6386091'), 'Q6386091');
  assert.equal(qidFromWikidataIri('https://www.wikidata.org/entity/q42'), 'Q42');
  assert.equal(qidFromWikidataIri('http://www.wikidata.org/entity/P649'), undefined);
});

test('commonsFileTitleFromImageIri decodes a Special:FilePath IRI into a File: title', () => {
  assert.equal(
    commonsFileTitleFromImageIri(
      'http://commons.wikimedia.org/wiki/Special:FilePath/KellyIngramPark.jpg',
    ),
    'File:KellyIngramPark.jpg',
  );
  assert.equal(
    commonsFileTitleFromImageIri(
      'http://commons.wikimedia.org/wiki/Special:FilePath/16th%20Street%20Baptist%20Church.jpg',
    ),
    'File:16th Street Baptist Church.jpg',
  );
  assert.equal(commonsFileTitleFromImageIri('http://example.com/not-a-filepath'), undefined);
});

test('parseNrhpImageSparqlResults groups by ref: no_item is simply absent', () => {
  const lookup = parseNrhpImageSparqlResults({ results: { bindings: [] } });
  assert.equal(lookup.size, 0);
});

test('parseNrhpImageSparqlResults keeps item_no_image refs with an empty fileTitles array', () => {
  const lookup = parseNrhpImageSparqlResults({
    results: {
      bindings: [
        { ref: { value: '84000636' }, item: { value: 'http://www.wikidata.org/entity/Q6386091' } },
      ],
    },
  });
  assert.deepEqual(lookup.get('84000636'), { qid: 'Q6386091', fileTitles: [] });
});

test('parseNrhpImageSparqlResults collects images in returned order and dedupes', () => {
  const lookup = parseNrhpImageSparqlResults({
    results: {
      bindings: [
        {
          ref: { value: '84000636' },
          item: { value: 'http://www.wikidata.org/entity/Q6386091' },
          image: {
            value: 'http://commons.wikimedia.org/wiki/Special:FilePath/KellyIngramPark.jpg',
          },
        },
        {
          ref: { value: '84000636' },
          item: { value: 'http://www.wikidata.org/entity/Q6386091' },
          image: {
            value: 'http://commons.wikimedia.org/wiki/Special:FilePath/KellyIngramPark2.jpg',
          },
        },
        {
          ref: { value: '84000636' },
          item: { value: 'http://www.wikidata.org/entity/Q6386091' },
          image: {
            value: 'http://commons.wikimedia.org/wiki/Special:FilePath/KellyIngramPark.jpg',
          },
        },
      ],
    },
  });
  assert.deepEqual(lookup.get('84000636'), {
    qid: 'Q6386091',
    fileTitles: ['File:KellyIngramPark.jpg', 'File:KellyIngramPark2.jpg'],
  });
});

test('buildNrhpCommonsImageRow: no qid → stage no_item, outcome no_qid', () => {
  const row = buildNrhpCommonsImageRow({
    entityId: 'nrhp-black-heritage-99999999',
    displayName: 'Some Place',
    refnum: '99999999',
  });
  assert.equal(row.stage, 'no_item');
  assert.equal(row.outcome, 'no_qid');
  assert.equal(row.kind, 'place');
  assert.equal(row.refnum, '99999999');
});

test('buildNrhpCommonsImageRow: qid with no images → stage item_no_image, outcome no_p18', () => {
  const row = buildNrhpCommonsImageRow({
    entityId: 'nrhp-black-heritage-11111111',
    displayName: 'Some Other Place',
    refnum: '11111111',
    lookup: { qid: 'Q1', fileTitles: [] },
  });
  assert.equal(row.stage, 'item_no_image');
  assert.equal(row.outcome, 'no_p18');
  assert.equal(row.wikidataId, 'Q1');
});

test('buildNrhpCommonsImageRow: image found + publishable license → auto_propose', () => {
  const row = buildNrhpCommonsImageRow({
    entityId: 'nrhp-black-heritage-84000636',
    displayName: 'Kelly Ingram Park',
    refnum: '84000636',
    lookup: { qid: 'Q6386091', fileTitles: ['File:KellyIngramPark.jpg'] },
    image: {
      fileTitle: 'File:KellyIngramPark.jpg',
      commonsPageUrl: 'https://commons.wikimedia.org/wiki/File:KellyIngramPark.jpg',
      fullUrl: 'https://upload.wikimedia.org/wikipedia/commons/x/xx/KellyIngramPark.jpg',
      licenseShortName: 'CC BY-SA 4.0',
      artist: 'Some Photographer',
      imageDescription: 'Kelly Ingram Park in Birmingham, Alabama.',
    },
  });
  assert.equal(row.stage, 'image_found');
  assert.equal(row.outcome, 'auto_propose');
  assert.equal(row.rightsStatus, 'licensed');
  assert.equal(row.fileTitle, 'File:KellyIngramPark.jpg');
  assert.equal(row.imageCandidateCount, undefined);
  assert.ok(row.alt && row.alt.length > 0);
  assert.ok(row.credit && row.credit.includes('Some Photographer'));
});

test('buildNrhpCommonsImageRow: image found but unmapped license → license_hold-shaped outcome', () => {
  const row = buildNrhpCommonsImageRow({
    entityId: 'nrhp-black-heritage-22222222',
    displayName: 'NC-Licensed Place',
    refnum: '22222222',
    lookup: {
      qid: 'Q2',
      fileTitles: ['File:A.jpg', 'File:B.jpg'],
    },
    image: {
      fileTitle: 'File:A.jpg',
      commonsPageUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
      licenseShortName: 'CC BY-NC 4.0',
    },
  });
  assert.equal(row.stage, 'image_found');
  assert.equal(row.outcome, 'license_unmapped');
  assert.equal(row.imageCandidateCount, 2);
});

test('summarizeNrhpCommonsImageRows tallies stages and splits image_found by outcome', () => {
  const rows: NrhpCommonsImageRow[] = [
    buildNrhpCommonsImageRow({
      entityId: 'e1',
      displayName: 'A',
      refnum: '1',
    }),
    buildNrhpCommonsImageRow({
      entityId: 'e2',
      displayName: 'B',
      refnum: '2',
      lookup: { qid: 'Q2', fileTitles: [] },
    }),
    buildNrhpCommonsImageRow({
      entityId: 'e3',
      displayName: 'C',
      refnum: '3',
      lookup: { qid: 'Q3', fileTitles: ['File:C.jpg'] },
      image: {
        fileTitle: 'File:C.jpg',
        commonsPageUrl: 'https://commons.wikimedia.org/wiki/File:C.jpg',
        fullUrl: 'https://upload.wikimedia.org/x/C.jpg',
        licenseShortName: 'Public domain',
        credit: 'NPS',
        imageDescription: 'C',
      },
    }),
    buildNrhpCommonsImageRow({
      entityId: 'e4',
      displayName: 'D',
      refnum: '4',
      lookup: { qid: 'Q4', fileTitles: ['File:D.jpg'] },
      image: {
        fileTitle: 'File:D.jpg',
        commonsPageUrl: 'https://commons.wikimedia.org/wiki/File:D.jpg',
        licenseShortName: 'CC BY-NC 4.0',
      },
    }),
  ];
  const counts = summarizeNrhpCommonsImageRows(rows);
  assert.deepEqual(counts, {
    total: 4,
    no_item: 1,
    item_no_image: 1,
    image_found: 2,
    auto_propose: 1,
    license_hold: 1,
  });
});
