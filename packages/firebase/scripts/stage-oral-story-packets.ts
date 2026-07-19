/**
 * Handcrafts citation-gated story.research.packet.v1 proposals (oral research method,
 * BlackStory voice), optionally rejects a mock submission, commits to quarantine via
 * the operator intake path, and writes a JSON report for PDF export.
 *
 * Usage (production ADC — same env as apps/admin):
 *   set -a && source apps/admin/.env.local && set +a
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/stage-oral-story-packets.ts --commit \
 *     --reject-mock 425e0db3-02b2-4745-81a2-651ee34ad1d3 \
 *     --report /tmp/story-packets-staged.json
 */
import { writeFileSync } from 'node:fs';
import {
  buildNamedAnchor,
  buildStoryCiteEntry,
  buildStoryResearchBrief,
  buildStoryResearchPacket,
  collectAuthorityLeadUrls,
  validateStoryResearchPacket,
  type NamedAnchor,
  type StoryCiteEntry,
  type StoryDraftSection,
  type StoryResearchPacket,
} from '@repo/domain';
import { createServerFirebaseApp, createAdminAtomicStore, FIRESTORE_ROOT } from '@repo/firebase';
import { commitOperatorIntake } from '../../operator-cli/src/commit.ts';
import { prepareStoryPacketIntake } from '../../operator-cli/src/story-intake.ts';
import { getFirestore } from 'firebase-admin/firestore';

const STORY_PACKET_REVIEW_COLLECTION = 'adminStoryPacketReviews';

type HandcraftedTopic = {
  readonly topicId: string;
  readonly topicTitle: string;
  readonly title: string;
  readonly dek: string;
  readonly eraLabel: string;
  readonly placeLabel: string;
  readonly slug: string;
  readonly relatedEntityIds: readonly string[];
  readonly relatedFactIds: readonly string[];
  readonly brief: ReturnType<typeof buildStoryResearchBrief>;
  readonly anchors: readonly NamedAnchor[];
  readonly sections: readonly StoryDraftSection[];
  readonly sentenceCites: readonly {
    readonly text: string;
    readonly citeKind: 'framing' | 'fact' | 'entity';
    readonly citeId?: string;
  }[];
  readonly authorityLeadUrls?: readonly string[];
};

const publishedClaimLookup = () => ({
  workflowStatus: 'accepted' as const,
  publicationStatus: 'published' as const,
});

function buildDraftAndCiteMap(topic: HandcraftedTopic): {
  readonly draft: StoryResearchPacket['draft'];
  readonly citeMap: readonly StoryCiteEntry[];
} {
  const citeMap: StoryCiteEntry[] = [];
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  const framingTexts = [
    topic.brief.thesisQuestion,
    `The popular telling often starts here: ${topic.brief.conventionalStartLine}`,
    `The archive starts earlier: ${topic.brief.relocatedStartLine}`,
  ];
  for (const text of framingTexts) {
    citeMap.push(
      buildStoryCiteEntry({ sentenceId: nextId('framing'), text, citeKind: 'framing' }),
    );
  }

  const body: StoryDraftSection[] = [
    { paragraphs: framingTexts },
    ...topic.sections,
  ];

  for (const section of topic.sections) {
    for (const paragraph of section.paragraphs) {
      const match = topic.sentenceCites.find((entry) => entry.text === paragraph);
      if (!match) {
        throw new Error(`Missing cite mapping for paragraph in ${topic.topicId}`);
      }
      citeMap.push(
        buildStoryCiteEntry({
          sentenceId: nextId('body'),
          text: match.text,
          citeKind: match.citeKind,
          ...(match.citeId !== undefined ? { citeId: match.citeId } : {}),
        }),
      );
    }
  }

  return {
    draft: {
      slug: topic.slug,
      title: topic.title,
      dek: topic.dek,
      eraLabel: topic.eraLabel,
      placeLabel: topic.placeLabel,
      body,
    },
    citeMap,
  };
}

function buildPacket(topic: HandcraftedTopic, nowIso: string): StoryResearchPacket {
  const { draft, citeMap } = buildDraftAndCiteMap(topic);
  const validation = validateStoryResearchPacket({
    brief: topic.brief,
    citeMap,
    draft,
    relatedEntityIds: topic.relatedEntityIds,
    relatedFactIds: topic.relatedFactIds,
    proposedDecision: 'recommend',
    lookupClaim: () => publishedClaimLookup(),
  });

  return buildStoryResearchPacket({
    topicId: topic.topicId,
    topicTitle: topic.topicTitle,
    decision: validation.decision,
    rationale:
      validation.decision === 'recommend'
        ? 'Handcrafted oral-method draft with resolved fact/entity cites for owner review.'
        : validation.issues.join('; '),
    confidence: validation.decision === 'recommend' ? 0.78 : 0.45,
    brief: topic.brief,
    anchors: topic.anchors,
    citeMap,
    relatedEntityIds: topic.relatedEntityIds,
    relatedFactIds: topic.relatedFactIds,
    draft,
    validationIssues: validation.issues,
    authorityLeadUrls: topic.authorityLeadUrls ?? collectAuthorityLeadUrls(topic.anchors),
    model: { provider: 'handcrafted', modelId: 'oral-story-craft-v1' },
    createdAt: nowIso,
    operatorId: process.env.USER ?? 'operator',
    sessionId: `stage-oral-${Date.now()}`,
  });
}

const TOPICS: readonly HandcraftedTopic[] = [
  {
    topicId: 'topic-dunbar-church-basement',
    topicTitle: 'Church basement public trust',
    title: 'A public school in a church basement',
    dek:
      'Before Dunbar was Dunbar — before M Street, before the poet’s name — forty-five students and one teacher opened America’s first Black public high school under a congregation’s roof.',
    eraLabel: '1870',
    placeLabel: 'Washington, D.C.',
    slug: 'public-school-in-a-church-basement',
    relatedEntityIds: ['ent_15th_st_church_001', 'ent_dunbar_school_001'],
    relatedFactIds: ['BB-F-000001'],
    brief: buildStoryResearchBrief({
      thesisQuestion:
        'Why does the first Black public high school in the United States open in a church basement instead of its own campus?',
      conventionalStartLine:
        'The Dunbar legend — famous alumni, later building, poet’s name on the marquee.',
      relocatedStartLine:
        '1870: William Syphax and the Board of Trustees for Colored Schools open the Preparatory High School for Colored Youth in the basement of Fifteenth Street Presbyterian Church.',
      mechanismLayers: [
        {
          kind: 'institutional',
          summary:
            'A public trust used a congregation’s basement because the city had not yet normalized a standalone campus for Black secondary education.',
        },
      ],
      verificationRule:
        'Start with the church address and the 1870 founding fact — not the nickname the school wears a century later.',
    }),
    anchors: [
      buildNamedAnchor({
        id: 'anchor-syphax-1870',
        role: 'named_case',
        who: 'William Syphax',
        whenLabel: '1870',
        whereLabel: 'Fifteenth Street Presbyterian Church, Washington, D.C.',
        note: 'President of the Board of Trustees for Colored Schools at founding.',
        resolvedCiteKind: 'fact',
        resolvedCiteId: 'BB-F-000001',
      })!,
      buildNamedAnchor({
        id: 'anchor-church-host',
        role: 'omitted',
        who: 'Fifteenth Street Presbyterian Church',
        whenLabel: '1870',
        whereLabel: 'Washington, D.C.',
        note: 'Host building — basement room, not a metaphor.',
        resolvedCiteKind: 'entity',
        resolvedCiteId: 'ent_15th_st_church_001',
      })!,
    ],
    sections: [
      {
        heading: 'What the middle of the story left out',
        paragraphs: [
          'William Syphax · 1870 · Fifteenth Street Presbyterian Church, Washington, D.C.. President of the Board of Trustees for Colored Schools at founding.',
          'Fifteenth Street Presbyterian Church · 1870 · Washington, D.C.. Host building — basement room, not a metaphor.',
        ],
      },
      {
        heading: 'How it worked',
        paragraphs: [
          'institutional: A public trust used a congregation’s basement because the city had not yet normalized a standalone campus for Black secondary education.',
        ],
      },
      {
        heading: 'What to check',
        paragraphs: [
          'Start with the church address and the 1870 founding fact — not the nickname the school wears a century later.',
        ],
      },
    ],
    sentenceCites: [
      {
        text: 'William Syphax · 1870 · Fifteenth Street Presbyterian Church, Washington, D.C.. President of the Board of Trustees for Colored Schools at founding.',
        citeKind: 'fact',
        citeId: 'BB-F-000001',
      },
      {
        text: 'Fifteenth Street Presbyterian Church · 1870 · Washington, D.C.. Host building — basement room, not a metaphor.',
        citeKind: 'entity',
        citeId: 'ent_15th_st_church_001',
      },
      {
        text: 'institutional: A public trust used a congregation’s basement because the city had not yet normalized a standalone campus for Black secondary education.',
        citeKind: 'framing',
      },
      {
        text: 'Start with the church address and the 1870 founding fact — not the nickname the school wears a century later.',
        citeKind: 'framing',
      },
    ],
    authorityLeadUrls: ['https://www.nps.gov/places/paul-laurence-dunbar-high-school.htm'],
  },
  {
    topicId: 'topic-dunbar-two-names-before-poet',
    topicTitle: 'Two names before the poet',
    title: 'Two names before Dunbar',
    dek:
      'The school carried two earlier titles — Preparatory High School for Colored Youth, then M Street — before the 1916 move that borrowed a poet’s name.',
    eraLabel: '1870–1916',
    placeLabel: 'Washington, D.C.',
    slug: 'two-names-before-dunbar',
    relatedEntityIds: ['ent_dunbar_school_001'],
    relatedFactIds: ['BB-F-000001', 'BB-F-000002', 'BB-F-000003'],
    brief: buildStoryResearchBrief({
      thesisQuestion:
        'What disappears when we start the Dunbar story at the poet’s name instead of the rename chain?',
      conventionalStartLine: 'Paul Laurence Dunbar High School — as if the institution appeared under that title.',
      relocatedStartLine:
        '1870 preparatory school, 1891 M Street High School, 1916 rename tied to a new Snowden Ashford building.',
      mechanismLayers: [
        {
          kind: 'institutional',
          summary:
            'Renaming tracks building moves and public memory — each title is a dated layer, not a synonym.',
        },
      ],
      winnerBuiltTest: {
        outcomeDocument: '1916 campus at 1st and N Streets NW (now 1301 New Jersey Avenue NW)',
        whatItProves:
          'The poet’s name arrived with a new building — not with the founding in 1870.',
      },
      verificationRule:
        'Read the three rename dates in order before you trust any single label on a tour sign.',
    }),
    anchors: [
      buildNamedAnchor({
        id: 'anchor-m-street-1891',
        role: 'named_case',
        whenLabel: '1891',
        whereLabel: 'Washington, D.C.',
        instrument: 'M Street High School',
        resolvedCiteKind: 'fact',
        resolvedCiteId: 'BB-F-000002',
      })!,
      buildNamedAnchor({
        id: 'anchor-dunbar-rename-1916',
        role: 'winner_built',
        whenLabel: '1916',
        whereLabel: '1st and N Streets NW',
        instrument: 'Paul Laurence Dunbar High School',
        resolvedCiteKind: 'fact',
        resolvedCiteId: 'BB-F-000003',
      })!,
    ],
    sections: [
      {
        heading: 'What the middle of the story left out',
        paragraphs: [
          '1891 · Washington, D.C. · instrument: M Street High School',
          'What the winners built: 1916 campus at 1st and N Streets NW (now 1301 New Jersey Avenue NW). The poet’s name arrived with a new building — not with the founding in 1870.',
        ],
      },
      {
        heading: 'What to check',
        paragraphs: [
          'Read the three rename dates in order before you trust any single label on a tour sign.',
        ],
      },
    ],
    sentenceCites: [
      {
        text: '1891 · Washington, D.C. · instrument: M Street High School',
        citeKind: 'fact',
        citeId: 'BB-F-000002',
      },
      {
        text: 'What the winners built: 1916 campus at 1st and N Streets NW (now 1301 New Jersey Avenue NW). The poet’s name arrived with a new building — not with the founding in 1870.',
        citeKind: 'fact',
        citeId: 'BB-F-000003',
      },
      {
        text: 'Read the three rename dates in order before you trust any single label on a tour sign.',
        citeKind: 'framing',
      },
    ],
  },
  {
    topicId: 'topic-dunbar-inventory-day-1975',
    topicTitle: 'April 29, 1975 inventory day',
    title: 'What April 29, 1975 actually marks',
    dek:
      'Historic listing and living campus are different claims — the D.C. Inventory date is checkable even when later demolition timelines get fuzzy.',
    eraLabel: '1975',
    placeLabel: 'Washington, D.C.',
    slug: 'inventory-day-1975',
    relatedEntityIds: ['ent_dc_landmark_listing_1975', 'ent_dunbar_school_001'],
    relatedFactIds: ['BB-F-000004'],
    brief: buildStoryResearchBrief({
      thesisQuestion:
        'What did the April 29, 1975 D.C. Inventory listing record — and what did it not promise about the bricks?',
      conventionalStartLine:
        '“Historic Dunbar” as if the 1916 building still stands for visitors to touch.',
      relocatedStartLine:
        'April 29, 1975: Paul Laurence Dunbar High School listed on the District of Columbia Inventory of Historic Sites.',
      mechanismLayers: [
        {
          kind: 'legal',
          summary:
            'Inventory listing documents designation intent — not a guarantee that later demolition debates would preserve fabric.',
        },
      ],
      presentBridge: {
        continuityClaim:
          'The school still operates on the same footprint; the inventory event is a dated designation layer on the graph.',
        verificationOffRamp:
          'Open BB-F-000004 and the DC Preservation League register entry — compare listing date to later campus rebuild facts.',
      },
      verificationRule:
        'Check the inventory date on the fact record before you conflate it with an unverified National Register rumor.',
    }),
    anchors: [
      buildNamedAnchor({
        id: 'anchor-inventory-1975',
        role: 'winner_built',
        whenLabel: 'April 29, 1975',
        whereLabel: 'Washington, D.C.',
        instrument: 'D.C. Inventory of Historic Sites listing',
        resolvedCiteKind: 'fact',
        resolvedCiteId: 'BB-F-000004',
      })!,
    ],
    sections: [
      {
        heading: 'What the winners built',
        paragraphs: [
          'What the winners built: D.C. Inventory of Historic Sites listing. Inventory listing documents designation intent — not a guarantee that later demolition debates would preserve fabric.',
        ],
      },
      {
        heading: 'What to check',
        paragraphs: [
          'The school still operates on the same footprint; the inventory event is a dated designation layer on the graph. Check: Open BB-F-000004 and the DC Preservation League register entry — compare listing date to later campus rebuild facts.',
          'Check the inventory date on the fact record before you conflate it with an unverified National Register rumor.',
        ],
      },
    ],
    sentenceCites: [
      {
        text: 'What the winners built: D.C. Inventory of Historic Sites listing. Inventory listing documents designation intent — not a guarantee that later demolition debates would preserve fabric.',
        citeKind: 'fact',
        citeId: 'BB-F-000004',
      },
      {
        text: 'The school still operates on the same footprint; the inventory event is a dated designation layer on the graph. Check: Open BB-F-000004 and the DC Preservation League register entry — compare listing date to later campus rebuild facts.',
        citeKind: 'framing',
      },
      {
        text: 'Check the inventory date on the fact record before you conflate it with an unverified National Register rumor.',
        citeKind: 'framing',
      },
    ],
  },
  {
    topicId: 'topic-dunbar-walls-came-down-twice',
    topicTitle: 'Walls came down twice',
    title: 'The walls came down twice',
    dek:
      'The campus students enter today is not the 1916 building — demolition in 1977 and again in 2013 is part of the place story visitors need before they arrive.',
    eraLabel: '1977–2013',
    placeLabel: 'Washington, D.C.',
    slug: 'walls-came-down-twice',
    relatedEntityIds: ['ent_dunbar_school_001'],
    relatedFactIds: ['BB-F-000003', 'BB-F-000005'],
    brief: buildStoryResearchBrief({
      thesisQuestion: 'When did the Dunbar campus become replaceable — and what does “same school” mean after that?',
      conventionalStartLine: 'Alumni nostalgia anchored to one immortal building.',
      relocatedStartLine:
        '1977 demolition of the 1916 Ashford building; 2013 demolition of its 1970s replacement; 2013 opening of a new structure on the same footprint.',
      mechanismLayers: [
        {
          kind: 'institutional',
          summary:
            'Institutional continuity survived two fabric replacements — plaques and portraits carry memory when walls cannot.',
        },
      ],
      verificationRule:
        'Match the building you are standing in to the dated demolition facts — not to the nickname on the sweatshirt.',
    }),
    anchors: [
      buildNamedAnchor({
        id: 'anchor-demolitions',
        role: 'named_case',
        whenLabel: '1977–2013',
        whereLabel: '1301 New Jersey Avenue NW',
        note: '1916 and 1970s buildings demolished; 2013 structure honors history without preserving original fabric.',
        resolvedCiteKind: 'fact',
        resolvedCiteId: 'BB-F-000005',
      })!,
    ],
    sections: [
      {
        heading: 'What the middle of the story left out',
        paragraphs: [
          '1977–2013 · 1301 New Jersey Avenue NW. 1916 and 1970s buildings demolished; 2013 structure honors history without preserving original fabric.',
        ],
      },
      {
        heading: 'What to check',
        paragraphs: [
          'Match the building you are standing in to the dated demolition facts — not to the nickname on the sweatshirt.',
        ],
      },
    ],
    sentenceCites: [
      {
        text: '1977–2013 · 1301 New Jersey Avenue NW. 1916 and 1970s buildings demolished; 2013 structure honors history without preserving original fabric.',
        citeKind: 'fact',
        citeId: 'BB-F-000005',
      },
      {
        text: 'Match the building you are standing in to the dated demolition facts — not to the nickname on the sweatshirt.',
        citeKind: 'framing',
      },
    ],
  },
  {
    topicId: 'topic-dunbar-alumni-thread',
    topicTitle: 'Alumni federation thread',
    title: 'Who holds the thread when walls turn over',
    dek:
      'The Dunbar Alumni Federation organized in 2002 — a living institution beside the school record when buildings cannot carry memory alone.',
    eraLabel: '2002–',
    placeLabel: 'Washington, D.C.',
    slug: 'alumni-thread-2002',
    relatedEntityIds: ['ent_dunbar_alumni_federation_001', 'ent_dunbar_school_001'],
    relatedFactIds: ['BB-F-000006'],
    brief: buildStoryResearchBrief({
      thesisQuestion:
        'When campus fabric turns over, who keeps the institutional thread that a map pin alone cannot hold?',
      conventionalStartLine: 'The school building as the sole keeper of Dunbar memory.',
      relocatedStartLine:
        '2002: Dunbar Alumni Federation organized as a 501(c)(3) for scholarships and preservation work.',
      winnerBuiltTest: {
        outcomeDocument: 'Dunbar Alumni Federation incorporation (501(c)(3), tax-exempt July 2003)',
        whatItProves:
          'Graduates built a separate institution to fund students and preserve history across rebuild eras.',
      },
      verificationRule:
        'Follow the federation entity pin for the organization — the school pin for the campus; neither replaces the other.',
    }),
    anchors: [
      buildNamedAnchor({
        id: 'anchor-daf-2002',
        role: 'winner_built',
        whenLabel: '2002',
        whereLabel: 'District of Columbia',
        instrument: 'Dunbar Alumni Federation 501(c)(3)',
        resolvedCiteKind: 'fact',
        resolvedCiteId: 'BB-F-000006',
      })!,
    ],
    sections: [
      {
        heading: 'What the winners built',
        paragraphs: [
          'What the winners built: Dunbar Alumni Federation incorporation (501(c)(3), tax-exempt July 2003). Graduates built a separate institution to fund students and preserve history across rebuild eras.',
        ],
      },
      {
        heading: 'What to check',
        paragraphs: [
          'Follow the federation entity pin for the organization — the school pin for the campus; neither replaces the other.',
        ],
      },
    ],
    sentenceCites: [
      {
        text: 'What the winners built: Dunbar Alumni Federation incorporation (501(c)(3), tax-exempt July 2003). Graduates built a separate institution to fund students and preserve history across rebuild eras.',
        citeKind: 'fact',
        citeId: 'BB-F-000006',
      },
      {
        text: 'Follow the federation entity pin for the organization — the school pin for the campus; neither replaces the other.',
        citeKind: 'framing',
      },
    ],
  },
  {
    topicId: 'topic-princeville-before-charter',
    topicTitle: 'Freedom Hill before the charter name',
    title: 'Freedom Hill before Princeville',
    dek:
      'On the Tar River floodplain opposite Tarboro, freedpeople governed daily life for twenty years before the 1885 charter — and the charter name honors Turner Prince, not the other way around.',
    eraLabel: '1865–1885',
    placeLabel: 'Princeville, North Carolina',
    slug: 'freedom-hill-before-princeville',
    relatedEntityIds: ['ent_princeville_nc_001'],
    relatedFactIds: ['BB-F-000102', 'BB-F-000101'],
    brief: buildStoryResearchBrief({
      thesisQuestion:
        'What was Princeville before the incorporation date — and whose name arrived with the charter?',
      conventionalStartLine:
        '“Oldest town chartered by African Americans” as a slogan without a settlement start line.',
      relocatedStartLine:
        '1865 Freedom Hill settlement after Union occupation; February 20, 1885 incorporation as Princeville honoring carpenter Turner Prince.',
      mechanismLayers: [
        {
          kind: 'institutional',
          summary:
            'Self-governance on purchased lots preceded the charter — incorporation formalized what floodplain residents already built.',
        },
      ],
      presentBridge: {
        continuityClaim:
          'Floods returned across the twentieth century; civic identity stayed tied to self-governance on the river bend.',
        verificationOffRamp:
          'Compare BB-F-000102 (1865 settlement) to BB-F-000101 (1885 charter) on the Princeville entity pin.',
      },
      verificationRule:
        'Start with Freedom Hill on the map, then read the charter date — not the superlative alone.',
    }),
    anchors: [
      buildNamedAnchor({
        id: 'anchor-freedom-hill',
        role: 'named_case',
        whenLabel: '1865',
        whereLabel: 'Tar River floodplain opposite Tarboro',
        note: 'Freedom Hill settlement after Union occupation.',
        resolvedCiteKind: 'fact',
        resolvedCiteId: 'BB-F-000102',
      })!,
      buildNamedAnchor({
        id: 'anchor-charter-1885',
        role: 'winner_built',
        whenLabel: 'February 20, 1885',
        whereLabel: 'Edgecombe County, North Carolina',
        instrument: 'Municipal charter as Princeville',
        resolvedCiteKind: 'fact',
        resolvedCiteId: 'BB-F-000101',
      })!,
    ],
    sections: [
      {
        heading: 'What the middle of the story left out',
        paragraphs: [
          '1865 · Tar River floodplain opposite Tarboro. Freedom Hill settlement after Union occupation.',
        ],
      },
      {
        heading: 'What the winners built',
        paragraphs: [
          'What the winners built: Municipal charter as Princeville. Self-governance on purchased lots preceded the charter — incorporation formalized what floodplain residents already built.',
        ],
      },
      {
        heading: 'What to check',
        paragraphs: [
          'Floods returned across the twentieth century; civic identity stayed tied to self-governance on the river bend. Check: Compare BB-F-000102 (1865 settlement) to BB-F-000101 (1885 charter) on the Princeville entity pin.',
          'Start with Freedom Hill on the map, then read the charter date — not the superlative alone.',
        ],
      },
    ],
    sentenceCites: [
      {
        text: '1865 · Tar River floodplain opposite Tarboro. Freedom Hill settlement after Union occupation.',
        citeKind: 'fact',
        citeId: 'BB-F-000102',
      },
      {
        text: 'What the winners built: Municipal charter as Princeville. Self-governance on purchased lots preceded the charter — incorporation formalized what floodplain residents already built.',
        citeKind: 'fact',
        citeId: 'BB-F-000101',
      },
      {
        text: 'Floods returned across the twentieth century; civic identity stayed tied to self-governance on the river bend. Check: Compare BB-F-000102 (1865 settlement) to BB-F-000101 (1885 charter) on the Princeville entity pin.',
        citeKind: 'framing',
      },
      {
        text: 'Start with Freedom Hill on the map, then read the charter date — not the superlative alone.',
        citeKind: 'framing',
      },
    ],
    authorityLeadUrls: ['https://www.loc.gov/'],
  },
];

function parseArgs(argv: readonly string[]): {
  commit: boolean;
  rejectMock?: string;
  report: string;
} {
  let commit = false;
  let rejectMock: string | undefined;
  let report = '/tmp/story-packets-staged.json';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--commit') commit = true;
    else if (arg === '--reject-mock') rejectMock = argv[++i];
    else if (arg === '--report') report = String(argv[++i] ?? report);
  }
  return { commit, rejectMock, report };
}

async function rejectMockPacket(submissionId: string): Promise<boolean> {
  const { app } = createServerFirebaseApp(process.env);
  const db = getFirestore(app);
  const inboxDoc = await db.collection(FIRESTORE_ROOT.submissionInbox).doc(submissionId).get();
  if (!inboxDoc.exists) {
    console.warn(`Mock submission not found: ${submissionId}`);
    return false;
  }
  const reviewedAt = new Date().toISOString();
  await db.collection(STORY_PACKET_REVIEW_COLLECTION).doc(submissionId).set(
    {
      submissionId,
      decision: 'rejected',
      reviewedAt,
      reviewedByEmail: 'operator-cli@blackstory.local',
      reviewedByUid: 'operator-cli',
      note: 'Rejected: mock provider skeleton — not oral-method handcrafted draft.',
    },
    { merge: true },
  );
  console.log(`Rejected mock packet ${submissionId} in ${STORY_PACKET_REVIEW_COLLECTION}`);
  return true;
}

async function main(): Promise<void> {
  if (process.env.APP_FIREBASE_ALLOW_PRODUCTION !== '1') {
    console.error('Refusing to write: set APP_FIREBASE_ALLOW_PRODUCTION=1');
    process.exit(2);
  }

  const args = parseArgs(process.argv.slice(2));
  const nowIso = new Date().toISOString();
  const packets = TOPICS.map((topic) => buildPacket(topic, nowIso));

  const report: {
    stagedAt: string;
    mockRejected: boolean;
    mockSubmissionId?: string;
    packets: readonly {
      topicId: string;
      title: string;
      decision: string;
      validationIssues: readonly string[];
      submissionId?: string;
      committed?: boolean;
    }[];
  } = {
    stagedAt: nowIso,
    mockRejected: false,
    packets: packets.map((packet) => ({
      topicId: packet.topicId,
      title: packet.draft.title,
      decision: packet.decision,
      validationIssues: packet.validationIssues,
    })),
  };

  if (args.rejectMock) {
    report.mockSubmissionId = args.rejectMock;
    report.mockRejected = await rejectMockPacket(args.rejectMock);
  }

  if (args.commit) {
    const pepper = process.env.OPERATOR_CLI_PRIVACY_PEPPER;
    if (!pepper) {
      console.error('Missing OPERATOR_CLI_PRIVACY_PEPPER');
      process.exit(2);
    }
    const { app } = createServerFirebaseApp(process.env);
    const store = createAdminAtomicStore(getFirestore(app));
    const identity = {
      operatorId: process.env.USER ?? 'operator',
      sessionId: `stage-oral-${Date.now()}`,
      source: 'cli' as const,
    };
    const context = {
      identity,
      privacyPepper: pepper,
      nowMs: Date.now(),
    };

    for (let index = 0; index < packets.length; index += 1) {
      const packet = packets[index]!;
      if (packet.decision === 'reject') {
        console.warn(`Skipping reject packet ${packet.topicId}`);
        continue;
      }
      const outcome = prepareStoryPacketIntake(packet, context);
      if (!outcome.accepted) {
        console.error(`Intake rejected for ${packet.topicId}:`, outcome.reason);
        continue;
      }
      const result = await commitOperatorIntake(store, outcome);
      const submissionId = outcome.mutations.find((m) => m.path.includes('submissionInbox'))?.path
        .split('/')
        .pop();
      report.packets[index] = {
        ...report.packets[index]!,
        ...(submissionId !== undefined ? { submissionId } : {}),
        committed: result.committed,
      };
      console.log(`Staged ${packet.topicId} committed=${result.committed} id=${submissionId ?? '?'}`);
    }
  } else {
    console.log('Dry run — pass --commit to stage quarantine packets.');
  }

  writeFileSync(args.report, JSON.stringify({ packets, report }, null, 2));
  console.log(`Report: ${args.report}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
