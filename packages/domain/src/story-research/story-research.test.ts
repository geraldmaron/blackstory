/**
 * Tests for citation-gated story research: cite-map fail-closed, unpublished claims,
 * trauma-hook openers, and an Alamo-shaped methodology fixture.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNamedAnchor, collectAuthorityLeadUrls } from './anchor.js';
import { assembleStorySkeleton } from './assemble.js';
import { buildStoryResearchBrief } from './brief.js';
import { buildStoryCiteEntry, citeEntryIsResolved } from './cite-map.js';
import {
  buildStoryResearchPacket,
  STORY_RESEARCH_PACKET_KIND,
  storyPacketToSeedRecord,
} from './packet.js';
import { validateStoryResearchPacket } from './validate.js';

const NOW = '2026-07-18T00:00:00.000Z';

const publishedClaim = {
  workflowStatus: 'accepted' as const,
  publicationStatus: 'published' as const,
};

const unpublishedClaim = {
  workflowStatus: 'accepted' as const,
  publicationStatus: 'unpublished' as const,
};

function alamoBrief() {
  return buildStoryResearchBrief({
    thesisQuestion:
      'What does “Remember the Alamo” leave out when the school story starts in 1836?',
    conventionalStartLine: 'Thirteen days at the Alamo mission in early 1836.',
    relocatedStartLine:
      'Mexico abolishes slavery in 1829 under Vicente Guerrero; American settlers in Texas refuse.',
    mechanismLayers: [
      {
        kind: 'legal',
        summary:
          'The Republic of Texas constitution of 1836 made slavery permanent and barred free Black residence without legislative permission.',
      },
    ],
    winnerBuiltTest: {
      outcomeDocument: 'Texas Constitution of 1836',
      whatItProves:
        'Independence produced a slave republic, not only a protest against Santa Anna’s centralization.',
    },
    presentBridge: {
      continuityClaim:
        'Families in the Southwest still say the border moved across them after 1848.',
      verificationOffRamp:
        'Read Treaty of Guadalupe Hidalgo land-grant promises vs later court outcomes.',
    },
    verificationRule:
      'Move the starting line before the battle cry, then judge by what the winners built.',
  });
}

function alamoAnchorsResolved() {
  const clarissa = buildNamedAnchor({
    id: 'anchor-clarissa',
    role: 'named_case',
    who: 'Clarissa',
    whenLabel: 'Christmas Day 1833',
    whereLabel: 'Texas (Mexican territory)',
    instrument: '99-year indenture contract',
    note: 'Forced contract used to evade Mexico’s abolition decree.',
    resolvedCiteKind: 'claim',
    resolvedCiteId: 'claim_clarissa_indenture',
  });
  const joe = buildNamedAnchor({
    id: 'anchor-joe',
    role: 'omitted',
    who: 'Joe',
    whenLabel: '1836',
    whereLabel: 'The Alamo, San Antonio',
    note: 'Enslaved by William Travis; survived the battle and was returned as property.',
    resolvedCiteKind: 'claim',
    resolvedCiteId: 'claim_joe_alamo_survivor',
    authorityLeadUrl: 'https://www.nps.gov/alamo/index.htm',
  });
  const constitution = buildNamedAnchor({
    id: 'anchor-tx-1836',
    role: 'winner_built',
    whenLabel: '1836',
    whereLabel: 'Republic of Texas',
    instrument: 'Texas Constitution of 1836',
    resolvedCiteKind: 'fact',
    resolvedCiteId: 'BB-F-TX-1836',
  });
  const lincoln = buildNamedAnchor({
    id: 'anchor-lincoln-spot',
    role: 'authority_witness',
    who: 'Abraham Lincoln',
    whenLabel: '1840s',
    instrument: 'Spot Resolutions',
    note: 'Demanded the exact spot on American soil where American blood was spilled.',
    resolvedCiteKind: 'claim',
    resolvedCiteId: 'claim_lincoln_spot',
  });
  assert.ok(clarissa && joe && constitution && lincoln);
  return [clarissa, joe, constitution, lincoln] as const;
}

test('buildNamedAnchor rejects non-authority lead URLs', () => {
  const bad = buildNamedAnchor({
    id: 'a1',
    role: 'named_case',
    authorityLeadUrl: 'https://random-blog.example/post',
  });
  assert.equal(bad, undefined);

  const good = buildNamedAnchor({
    id: 'a2',
    role: 'named_case',
    authorityLeadUrl: 'https://www.loc.gov/item/example/',
  });
  assert.ok(good);
  assert.ok(good.authorityLeadUrl?.startsWith('https://'));
});

test('citeEntryIsResolved treats framing as resolved and unresolved as not', () => {
  assert.equal(
    citeEntryIsResolved(buildStoryCiteEntry({ sentenceId: 's1', text: 'x', citeKind: 'framing' })),
    true,
  );
  assert.equal(
    citeEntryIsResolved(
      buildStoryCiteEntry({ sentenceId: 's2', text: 'x', citeKind: 'unresolved' }),
    ),
    false,
  );
  assert.equal(
    citeEntryIsResolved(
      buildStoryCiteEntry({
        sentenceId: 's3',
        text: 'x',
        citeKind: 'claim',
        citeId: 'c1',
      }),
    ),
    true,
  );
});

test('Alamo-shaped skeleton recommends only with resolved cites and off-ramps', () => {
  const brief = alamoBrief();
  const anchors = alamoAnchorsResolved();
  const skeleton = assembleStorySkeleton({
    brief,
    anchors,
    title: 'Before the battle cry',
    dek: 'Mexico’s abolition, forced contracts, and what the Texas republic built after the Alamo.',
    eraLabel: '1821–1848',
    placeLabel: 'Texas / northern Mexico',
    slug: 'before-the-battle-cry',
  });

  const lookup = (id: string) => {
    const published = new Set([
      'claim_clarissa_indenture',
      'claim_joe_alamo_survivor',
      'claim_lincoln_spot',
    ]);
    if (published.has(id)) return publishedClaim;
    return undefined;
  };

  const validation = validateStoryResearchPacket({
    brief,
    citeMap: skeleton.citeMap,
    draft: skeleton.draft,
    relatedEntityIds: ['ent_alamo_mission', 'ent_republic_of_texas'],
    relatedFactIds: ['BB-F-TX-1836'],
    proposedDecision: 'recommend',
    lookupClaim: lookup,
  });

  assert.equal(validation.decision, 'recommend');
  assert.equal(validation.ok, true);
  assert.equal(validation.issues.length, 0);

  const packet = buildStoryResearchPacket({
    topicId: 'topic-alamo-start-line',
    topicTitle: 'Alamo start-line relocation',
    decision: validation.decision,
    rationale: 'Start-line move + omitted actors + winner-built test resolved.',
    confidence: 0.82,
    brief,
    anchors,
    citeMap: skeleton.citeMap,
    relatedEntityIds: ['ent_alamo_mission', 'ent_republic_of_texas'],
    relatedFactIds: ['BB-F-TX-1836'],
    draft: skeleton.draft,
    validationIssues: validation.issues,
    authorityLeadUrls: collectAuthorityLeadUrls(anchors),
    createdAt: NOW,
  });

  assert.equal(packet.kind, STORY_RESEARCH_PACKET_KIND);
  assert.ok(packet.authorityLeadUrls.some((url) => url.includes('nps.gov')));

  const seed = storyPacketToSeedRecord(packet, '2026-07-18');
  assert.equal(seed.slug, 'before-the-battle-cry');
  assert.equal(seed.relatedEntityIds.length, 2);
});

test('unresolved cites demote recommend to needs_evidence', () => {
  const brief = alamoBrief();
  const unresolvedAnchor = buildNamedAnchor({
    id: 'anchor-open',
    role: 'omitted',
    who: 'Unknown omitted actor',
    whenLabel: '1836',
    note: 'No published claim yet.',
  });
  assert.ok(unresolvedAnchor);

  const skeleton = assembleStorySkeleton({
    brief,
    anchors: [unresolvedAnchor],
    title: 'Incomplete Alamo draft',
    dek: 'Missing cites block recommend.',
    eraLabel: '1836',
    placeLabel: 'Texas',
  });

  const validation = validateStoryResearchPacket({
    brief,
    citeMap: skeleton.citeMap,
    draft: skeleton.draft,
    relatedEntityIds: ['ent_alamo_mission'],
    relatedFactIds: [],
    proposedDecision: 'recommend',
    lookupClaim: () => publishedClaim,
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.decision, 'needs_evidence');
  assert.ok(validation.issues.some((issue) => issue.includes('Unresolved cite')));
});

test('unpublished claim cannot be recommended', () => {
  const brief = alamoBrief();
  const anchor = buildNamedAnchor({
    id: 'a',
    role: 'named_case',
    who: 'Clarissa',
    resolvedCiteKind: 'claim',
    resolvedCiteId: 'claim_unpublished',
  });
  assert.ok(anchor);
  const skeleton = assembleStorySkeleton({
    brief,
    anchors: [anchor],
    title: 'Unpublished cite',
    dek: 'Should fail.',
    eraLabel: '1833',
    placeLabel: 'Texas',
  });

  const validation = validateStoryResearchPacket({
    brief,
    citeMap: skeleton.citeMap,
    draft: skeleton.draft,
    relatedEntityIds: ['ent_x'],
    relatedFactIds: [],
    proposedDecision: 'recommend',
    lookupClaim: (id) => (id === 'claim_unpublished' ? unpublishedClaim : undefined),
  });

  assert.equal(validation.decision, 'needs_evidence');
  assert.ok(validation.issues.some((issue) => issue.includes('unpublished')));
});

test('trauma-hook opener is blocked', () => {
  const brief = alamoBrief();
  const draft = {
    title: 'Graphic lead',
    dek: 'A dek.',
    eraLabel: '1918',
    placeLabel: 'Georgia',
    body: [
      {
        paragraphs: [
          "They cut her open while she was still alive — trigger warning, it's about to get graphic.",
        ],
      },
    ],
  };

  const validation = validateStoryResearchPacket({
    brief,
    citeMap: [
      buildStoryCiteEntry({
        sentenceId: 's1',
        text: draft.body[0]!.paragraphs[0]!,
        citeKind: 'framing',
      }),
    ],
    draft,
    relatedEntityIds: ['ent_x'],
    relatedFactIds: [],
    proposedDecision: 'recommend',
  });

  assert.equal(validation.decision, 'needs_evidence');
  assert.ok(validation.issues.some((issue) => issue.includes('Trauma-forward')));
});

test('unsourced sweeping market claim is blocked without a cite', () => {
  const brief = alamoBrief();
  const draft = {
    title: 'Sweep',
    dek: 'A dek about markets.',
    eraLabel: '2020s',
    placeLabel: 'Global',
    body: [
      {
        paragraphs: [
          'The global skin lightening market is worth between 14 and 19 billion per year.',
        ],
      },
    ],
  };

  const validation = validateStoryResearchPacket({
    brief,
    citeMap: [
      buildStoryCiteEntry({
        sentenceId: 's1',
        text: draft.body[0]!.paragraphs[0]!,
        citeKind: 'framing',
      }),
    ],
    draft,
    relatedEntityIds: ['ent_x'],
    relatedFactIds: [],
    proposedDecision: 'recommend',
  });

  assert.ok(validation.issues.some((issue) => issue.includes('Unsourced sweeping')));
});

test('recommend without off-ramps fails', () => {
  const brief = alamoBrief();
  const anchors = alamoAnchorsResolved();
  const skeleton = assembleStorySkeleton({
    brief,
    anchors,
    title: 'No off-ramps',
    dek: 'Missing related ids.',
    eraLabel: '1836',
    placeLabel: 'Texas',
  });

  const validation = validateStoryResearchPacket({
    brief,
    citeMap: skeleton.citeMap,
    draft: skeleton.draft,
    relatedEntityIds: [],
    relatedFactIds: [],
    proposedDecision: 'recommend',
    lookupClaim: () => publishedClaim,
  });

  assert.equal(validation.decision, 'needs_evidence');
  assert.ok(validation.issues.some((issue) => issue.includes('off-ramp')));
});
