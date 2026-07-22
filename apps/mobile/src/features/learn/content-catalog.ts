/**
 * Bundled Learn/More content catalog (MOB-015).
 *
 * Every entry is shaped as a real `ContentPageV1` (content-types.ts) — the same shape
 * `packages/public-contracts/src/v1/content.ts` defines for web's `/stories`, and the shape this
 * feature's `ContentRenderer` is built against. No live `/v1/content/{slug}` endpoint exists in
 * `apps/api-public` yet (grepped: no route references `ContentPageV1`/`content-page` at the time
 * this was written), so — exactly like web's own `/stories`, `/legal`, `/errata`, `/about`
 * surfaces, which are ALSO backed by local seed catalogs today (`stories-seed.ts`,
 * `legal-seed.ts`, `errata-seed.ts`), not a live content API — this catalog is bundled with the
 * app. `content-repository.ts` treats it as the "network" response for the offline-cache-then-
 * serve flow, so the app is correctly exercised end-to-end today and the only thing a future bead
 * changes is swapping this module's role from "source of truth" to "seed data +
 * network fallback" once `/v1/content` ships.
 *
 * History/Methodology/About prose below restates real, already-public copy from
 * `apps/web/src/app/about/page.tsx` and `apps/web/src/app/methodology/MethodologySections.tsx`
 * (condensed to plain paragraphs — no bespoke definition-list/trust-constant components, which
 * live in `packages/domain` and must never be imported by mobile per ADR-021). Legal copy states
 * only what the program's own accepted invariants already establish (CLAUDE.md's program
 * invariants, ADR-021/ADR-022) rather than fabricating legal commitments.
 */
import type { CitationV1, ContentPageV1 } from './content-types';

export type LearnCatalogSectionId = 'history' | 'topics' | 'myths' | 'methodology';
export type MoreCatalogSectionId = 'about' | 'facts' | 'legal' | 'errata';
export type CatalogSectionId = LearnCatalogSectionId | MoreCatalogSectionId;

/** "Privacy" is a More-tab navigation shortcut straight to the `legal/privacy` catalog entry, not
 * its own catalog section — see `sections.ts`'s `MORE_SECTIONS` for the row that resolves it. */

export interface LearnContentEntry {
  readonly section: CatalogSectionId;
  readonly page: ContentPageV1;
  /** Local editorial "primary sources" metadata (real `CitationV1` shape, see content-types.ts),
   * NOT a wire field of `ContentPageV1`. */
  readonly sources?: readonly CitationV1[];
  /** True for pages where an absent `sources` list is itself an adversarial condition worth
   * flagging (methodology/legal explainers should always cite something). */
  readonly requiresCitation?: boolean;
  /** The release content-version this bundled snapshot corresponds to (see legal-version.ts). */
  readonly contentVersion: string;
}

const BUNDLED_CONTENT_VERSION = 'content-v1';

export const CONTENT_CATALOG: readonly LearnContentEntry[] = [
  // --- History -------------------------------------------------------------------------------
  {
    section: 'history',
    contentVersion: BUNDLED_CONTENT_VERSION,
    page: {
      slug: 'basement-to-m-street',
      title: 'From a church basement to M Street',
      dek: 'How the Preparatory High School for Colored Youth began under Fifteenth Street Presbyterian and became the school Washington would later call Dunbar.',
      publishedAt: '2026-07-17',
      eraLabel: '1870–1891',
      placeLabel: 'Washington, D.C.',
      relatedEntityIds: ['ent_dunbar_school_001', 'ent_15th_st_church_001'],
      relatedFactIds: ['BB-F-000001', 'BB-F-000002'],
      body: [
        {
          paragraphs: [
            'In 1870, William Syphax and the Board of Trustees for Colored Schools opened a public high school for Black students in the basement of Fifteenth Street Presbyterian Church. Forty-five students and one teacher, Emma J. Hutchins, made a beginning that the country had not yet normalized: a public secondary school for Black youth, funded as a public trust.',
            'The church basement was not a metaphor. It was a room with a street address, a congregation above it, and a school day that had to share space with worship. The archive pins that founding to place first — a checkable coordinate in the capital’s educational geography.',
          ],
        },
        {
          heading: 'A name that moved with the school',
          paragraphs: [
            'By 1891 the school had outgrown the basement identity. Renamed M Street High School, it carried the same institutional thread under a street name residents could find on a map. The later Dunbar name arrived in 1916; the earlier names remain part of the record so readers do not collapse a multi-name history into its best-known label.',
          ],
        },
      ],
    },
  },
  {
    section: 'history',
    contentVersion: BUNDLED_CONTENT_VERSION,
    page: {
      slug: 'naming-dunbar-1916',
      title: 'Naming Dunbar in 1916',
      dek: 'When M Street High School became Paul Laurence Dunbar High School, the rename marked a new building and a poet’s name — not the invention of the school itself.',
      publishedAt: '2026-07-17',
      eraLabel: '1916',
      placeLabel: 'Washington, D.C.',
      relatedEntityIds: ['ent_dunbar_school_001'],
      relatedFactIds: ['BB-F-000003'],
      body: [
        {
          paragraphs: [
            'In 1916 the school moved into a new building and took the name of Paul Laurence Dunbar. The rename is often remembered as if the institution appeared fully formed under that title. The primary record is clearer: two earlier names already sit on the timeline, and the 1916 moment is a renaming tied to a building, not a founding from nothing.',
          ],
        },
      ],
    },
  },

  // --- Topics (web: /topics permanently redirects to /stories — same content, same catalog) ---
  {
    section: 'topics',
    contentVersion: BUNDLED_CONTENT_VERSION,
    page: {
      slug: 'same-footprint-new-walls',
      title: 'Same footprint, new walls',
      dek: 'The Dunbar campus students visit today is not the 1916 building. Demolition and rebuild are part of the institutional story.',
      publishedAt: '2026-07-17',
      eraLabel: '1977–2013',
      placeLabel: 'Washington, D.C.',
      relatedEntityIds: ['ent_dunbar_school_001', 'ent_dc_landmark_listing_1975'],
      relatedFactIds: ['BB-F-000004', 'BB-F-000005'],
      body: [
        {
          paragraphs: [
            'Historic listing and living campus are not the same claim. The school’s place on the D.C. Inventory of Historic Sites in 1975 sits beside a later architectural reality: the 1916 building was demolished, its 1970s replacement was demolished, and the structure opened in 2013 stands on the same footprint with a different fabric.',
          ],
        },
      ],
    },
  },

  // --- Myths -----------------------------------------------------------------------------------
  {
    section: 'myths',
    contentVersion: BUNDLED_CONTENT_VERSION,
    page: {
      slug: 'dunbar-founded-1916',
      title: 'Myth: Dunbar was founded in 1916',
      dek: 'The 1916 renaming is often mistaken for the school’s founding. The documented record traces the institution back to 1870.',
      publishedAt: '2026-07-17',
      eraLabel: '1870–1916',
      placeLabel: 'Washington, D.C.',
      relatedEntityIds: ['ent_dunbar_school_001'],
      relatedFactIds: ['BB-F-000001', 'BB-F-000003'],
      body: [
        {
          heading: 'What the record actually shows',
          paragraphs: [
            'A rename tied to a new building in 1916 is often retold as an origin story. The archive keeps the earlier names — the Preparatory High School for Colored Youth, then M Street High School — on the public timeline precisely so this myth has a citable correction rather than a silent one.',
          ],
        },
      ],
    },
  },

  // --- Methodology (condensed from apps/web/src/app/methodology/MethodologySections.tsx) -------
  {
    section: 'methodology',
    contentVersion: BUNDLED_CONTENT_VERSION,
    requiresCitation: true,
    sources: [
      { source: 'BlackStory', label: 'Full methodology (web)', href: 'https://blackbook.app/methodology' },
    ],
    page: {
      slug: 'overview',
      title: 'Methodology',
      dek: 'How records are researched, cited, and verified before publication.',
      publishedAt: '2026-07-01',
      eraLabel: '',
      placeLabel: '',
      relatedEntityIds: [],
      relatedFactIds: [],
      body: [
        {
          heading: 'Mission & scope',
          paragraphs: [
            'BlackStory publishes released historical projections — place-connected Black history with provenance, confidence grades, and living-person protections. History should not be erased: corrections append, disagreements stay visible, and withdrawn records remain resolvable. History should not be hard to find: every public claim carries citations and a path back to sources.',
          ],
        },
        {
          heading: 'Verification & triangulation',
          paragraphs: [
            'Every published fact passes an independent citation-completeness gate: structured references, supporting excerpts, retrieval dates, and archived captures for web sources. Triangulation means at least two independent lineages before a fact reaches corroborated grade; syndicated copies do not inflate scores.',
          ],
        },
        {
          heading: 'Corrections',
          paragraphs: [
            'Errors are fixed fully, quickly, and without defensiveness. Every change is timestamped, categorized, and preserved — nothing is silently edited. See Errata for the change log.',
          ],
        },
      ],
    },
  },

  // --- About (condensed from apps/web/src/app/about/page.tsx) -----------------------------------
  {
    section: 'about',
    contentVersion: BUNDLED_CONTENT_VERSION,
    page: {
      slug: 'about',
      title: 'History, pinned to place.',
      dek: 'BlackStory is a place-connected Black history research platform.',
      publishedAt: '2026-07-01',
      eraLabel: '',
      placeLabel: '',
      relatedEntityIds: [],
      relatedFactIds: [],
      body: [
        {
          heading: 'History should not be erased',
          paragraphs: [
            'When sources disagree, both claims stay on the record instead of one quietly winning. When a fact is corrected, the earlier wording remains visible in revision history. Withdrawals stay resolvable with a plain-language reason.',
          ],
        },
        {
          heading: 'It should not be hard to find',
          paragraphs: [
            'Most people pass documented Black history without knowing it is there. BlackStory puts the record back on the ground: open the map, start with a state, search by name or place, or follow a decade of movement. Every published claim carries citations and confidence you can read in words and glyphs — never color alone.',
          ],
        },
        {
          heading: 'Accessible because it is about you',
          paragraphs: [
            'This is not a remote museum shelf. It is history pinned to the places people live, teach, report from, and visit — with evidence attached, dignity rules enforced, and living people protected.',
          ],
        },
      ],
    },
  },

  // --- Facts (a bounded digest, not the full faceted fact browser — see MOB-015 report) ---------
  {
    section: 'facts',
    contentVersion: BUNDLED_CONTENT_VERSION,
    page: {
      slug: 'quick-facts',
      title: 'Quick facts',
      dek: 'A short digest of individually cited facts. Open a record for full evidence and revision history.',
      publishedAt: '2026-07-01',
      eraLabel: '',
      placeLabel: '',
      relatedEntityIds: ['ent_dunbar_school_001'],
      relatedFactIds: ['BB-F-000001', 'BB-F-000002', 'BB-F-000003', 'BB-F-000004', 'BB-F-000005'],
      body: [
        {
          paragraphs: [
            'Every fact on BlackStory carries its own citations and a status: published, corrected, superseded, or deprecated. This digest links to a handful of cited facts related to entries elsewhere in Learn — open a fact record for its full evidence and revision history.',
          ],
        },
      ],
    },
  },

  // --- Legal (privacy + terms) --------------------------------------------------------------------
  {
    section: 'legal',
    contentVersion: BUNDLED_CONTENT_VERSION,
    requiresCitation: true,
    sources: [{ source: 'BlackStory', label: 'Full privacy policy (web)', href: 'https://blackbook.app/legal/privacy' }],
    page: {
      slug: 'privacy',
      title: 'Privacy',
      dek: 'What this app collects, and what it deliberately does not.',
      publishedAt: '2026-06-01',
      eraLabel: '',
      placeLabel: '',
      relatedEntityIds: [],
      relatedFactIds: [],
      body: [
        {
          heading: 'What we do not do',
          paragraphs: [
            'This app ships with no advertising or tracking SDKs. Query text you type, correction-submission content, and precise device location are never written to on-device storage and never appear in logs or crash reports.',
          ],
        },
        {
          heading: 'What is cached on your device',
          paragraphs: [
            'Previously-viewed records, evidence, and content pages are cached so they remain readable offline. Cached search results are keyed by a salted hash of your query shape, never the raw text you typed.',
          ],
        },
      ],
    },
  },
  {
    section: 'legal',
    contentVersion: BUNDLED_CONTENT_VERSION,
    requiresCitation: true,
    sources: [{ source: 'BlackStory', label: 'Full terms of service (web)', href: 'https://blackbook.app/legal/terms' }],
    page: {
      slug: 'terms',
      title: 'Terms of service',
      dek: 'The plain-language summary; the full terms live on the web app.',
      publishedAt: '2026-06-01',
      eraLabel: '',
      placeLabel: '',
      relatedEntityIds: [],
      relatedFactIds: [],
      body: [
        {
          paragraphs: [
            'BlackStory is a read-only reference app. There are no user accounts, no purchases, and no user-generated content beyond an opaque correction submission (reviewed before anything is published). See the full terms on the web app for the complete legal text.',
          ],
        },
      ],
    },
  },

  // --- Errata (digest of the corrections log; each entry becomes one body section) --------------
  {
    section: 'errata',
    contentVersion: BUNDLED_CONTENT_VERSION,
    page: {
      slug: 'errata',
      title: 'Errata log',
      dek: 'Reverse-chronological corrections, clarifications, updates, and editor notes.',
      publishedAt: '2026-07-15',
      eraLabel: '',
      placeLabel: '',
      relatedEntityIds: [],
      relatedFactIds: [],
      body: [
        {
          heading: '2026-07-15 · Correction — Dunbar founding year',
          paragraphs: [
            'Corrected a caption that implied the 1916 renaming was the school’s founding. The founding date (1870) and the two earlier names now appear on the same timeline.',
          ],
        },
        {
          heading: '2026-06-02 · Update — Landmark listing added',
          paragraphs: [
            'Added the 1975 D.C. Inventory of Historic Sites listing as a distinct, dated event separate from the 2013 building.',
          ],
        },
      ],
    },
  },
];

export function listCatalogEntries(section: CatalogSectionId): readonly LearnContentEntry[] {
  return CONTENT_CATALOG.filter((entry) => entry.section === section);
}

export function findCatalogEntry(section: CatalogSectionId, slug: string): LearnContentEntry | undefined {
  return CONTENT_CATALOG.find((entry) => entry.section === section && entry.page.slug === slug);
}
