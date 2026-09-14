/**
 * The bundled publication catalog: narrative Stories and the supporting reference pages.
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
 * live in `packages/domain` and are not reachable from mobile: mobile imports only client-safe
 * subpaths of that package, and nothing lints the line — see `docs/decisions-carryover.md`,
 * "ADR-021's two invariants": the client/server boundary). Legal copy states
 * only what the program's own accepted invariants already establish (CLAUDE.md's program
 * invariants; `docs/decisions-carryover.md`, "ADR-021's two invariants", "Mobile data boundary"
 * and "Mobile cache and OTA release") rather than fabricating legal commitments. One sentence of
 * the bundled privacy page has since drifted past that rule — see "Mobile data boundary" for
 * which one.
 *
 * FAQ/Support prose below is condensed the same way, from `apps/web/src/app/faq/faq-copy.ts` and
 * `apps/web/src/app/support/page.tsx`. Neither invents a contact channel, a process, or a
 * turnaround time the web page does not already state — the support email below is the literal
 * `SUPPORT_CONTACT` default (`apps/web/src/lib/config/contact.ts`).
 */
import type { CitationV1, ContentPageV1 } from './content-types';

/**
 * The narrative partition. One id, not three.
 *
 * `history | topics | myths` would put three parallel content trees in front of a reader for
 * what is one publication surface. History is an era facet, a topic is a tag, and a myth
 * correction is an editorial FORMAT — so the distinction that actually matters lives on
 * {@link ContentEntry.format} rather than in three destinations.
 */
export type StoryCatalogSectionId = 'stories';

/** The supporting reference pages. Each is one page, addressed by its own route. */
export type SupportingCatalogSectionId =
  'about' | 'faq' | 'methodology' | 'errata' | 'privacy' | 'terms' | 'support';

export type CatalogSectionId = StoryCatalogSectionId | SupportingCatalogSectionId;

/**
 * The editorial format of a narrative piece.
 *
 * `myth` is not a section and not a tag: a myth correction has a shape — the claim, why it is
 * repeated, what the record actually shows, the evidence — and that shape is what a reader is
 * choosing when they open one. Naming it here is what let the old `/myths` surface be retired
 * without losing the content or the distinction.
 */
export type StoryFormat = 'chapter' | 'entry' | 'myth';

export interface ContentEntry {
  readonly section: CatalogSectionId;
  /** Present exactly on narrative entries. */
  readonly format?: StoryFormat;
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

export const CONTENT_CATALOG: readonly ContentEntry[] = [
  // --- Stories: chapters -------------------------------------------------------------------------------
  {
    section: 'stories',
    format: 'chapter',
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
            'The church basement was not a metaphor. It was a room with a street address, a congregation above it, and a school day that had to share space with worship. The archive pins that founding to place first: a checkable coordinate in the capital’s educational geography.',
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
    section: 'stories',
    format: 'chapter',
    contentVersion: BUNDLED_CONTENT_VERSION,
    page: {
      slug: 'naming-dunbar-1916',
      title: 'Naming Dunbar in 1916',
      dek: 'When M Street High School became Paul Laurence Dunbar High School, the rename marked a new building and a poet’s name, not the invention of the school itself.',
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
    section: 'stories',
    format: 'entry',
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

  // --- Stories: myth corrections -----------------------------------------------------------------------------------
  {
    section: 'stories',
    format: 'myth',
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
            'A rename tied to a new building in 1916 is often retold as an origin story. The archive keeps the earlier names, the Preparatory High School for Colored Youth, then M Street High School, on the public timeline precisely so this myth has a citable correction rather than a silent one.',
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
      {
        source: 'BlackStory',
        label: 'Full methodology (web)',
        href: 'https://blackstory.app/methodology',
      },
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
            'BlackStory publishes released historical projections: place-connected Black history with provenance, confidence grades, and living-person protections. History should not be erased: corrections append, disagreements stay visible, and withdrawn records remain resolvable. History should not be hard to find: every public claim carries citations and a path back to sources.',
          ],
        },
        {
          heading: 'Verification & triangulation',
          paragraphs: [
            'Every published fact passes an independent citation-completeness gate: structured references, supporting excerpts, retrieval dates, and archived captures for web sources. Triangulation means at least two independent lineages before a fact reaches corroborated grade; syndicated copies do not inflate scores.',
          ],
        },
        {
          heading: 'What a fact carries',
          paragraphs: [
            'Every fact on BlackStory carries its own citations and a status: published, corrected, superseded, or deprecated. Open a record to see its full evidence and its revision history. This is the one claim the old Quick facts digest made, and it belongs here, where a reader goes to ask how the archive decides.',
          ],
        },
        {
          heading: 'Corrections',
          paragraphs: [
            'Errors are fixed fully, quickly, and without defensiveness. Every change is timestamped, categorized, and preserved. Nothing is silently edited. See Errata for the change log.',
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
            'Most people pass documented Black history without knowing it is there. BlackStory puts the record back on the ground: open the map, start with a state, search by name or place, or follow a decade of movement. Every published claim carries citations and confidence you can read in words and glyphs, never color alone.',
          ],
        },
        {
          heading: 'Accessible because it is about you',
          paragraphs: [
            'This is not a remote museum shelf. It is history pinned to the places people live, teach, report from, and visit, with evidence attached, dignity rules enforced, and living people protected.',
          ],
        },
      ],
    },
  },

  // --- FAQ (condensed from apps/web/src/app/faq/faq-copy.ts) ------------------------------------
  {
    section: 'faq',
    contentVersion: BUNDLED_CONTENT_VERSION,
    requiresCitation: true,
    sources: [
      {
        source: 'BlackStory',
        label: 'Full FAQ (web)',
        href: 'https://blackstory.app/faq',
      },
    ],
    page: {
      slug: 'faq',
      title: 'Questions',
      dek: 'Plain answers to what people actually ask, including the two most people are too polite to ask: who is behind this, and how much of it is made by a machine.',
      publishedAt: '2026-07-01',
      eraLabel: '',
      placeLabel: '',
      relatedEntityIds: [],
      relatedFactIds: [],
      body: [
        {
          heading: 'Who runs this',
          paragraphs: [
            'One person: Gerald Dagher. There is no staff, no department, and no institution behind the name. This is a personal project that publishes public records with their sources attached, so the only thing holding a claim up is the citation next to it.',
          ],
        },
        {
          heading: 'Is any of this made by AI?',
          paragraphs: [
            'No. The facts come from sources: archives, agency databases, court reporters, library catalogs, National Register nominations, and published scholarship. Every accepted claim carries the citations it rests on.',
            'AI is used in two places: to search and pull source material that a person then checks against the original, and in drafting the long-form writing under a written voice standard. It never decides whether a record is true, what confidence grade it carries, or whether anything goes live.',
          ],
        },
        {
          heading: 'What does a confidence grade mean?',
          paragraphs: [
            'Established: several independent, high-authority sources agree and there is no serious dispute. Corroborated: two or more independent sources support it. Single source: one source that meets the citation bar, not yet checked against another. Contested: credible sources disagree, and the record names the disagreement. A grade measures independence and closeness to the event, nothing else.',
          ],
        },
        {
          heading: 'I found a mistake. What do I do?',
          paragraphs: [
            'Use the corrections form. You get a receipt code, the only credential for checking what happened to your report. A person reads it against the published sources; if accepted, the record changes and the change is published in the errata with the earlier wording still readable. There is no promised turnaround: one person reads these.',
          ],
        },
        {
          heading: 'Can I add something that is missing?',
          paragraphs: [
            'Yes. Use the lead form. You do not need an account, an affiliation, or a credential. Every lead is read before anything is published, and nothing goes public without a source someone else can check.',
          ],
        },
        {
          heading: 'Do I need an account?',
          paragraphs: [
            'No. Every public page works without signing in, and nothing here asks who you are in order to read it.',
          ],
        },
      ],
    },
  },

  // --- Product policy. Not Law: `/law` is historical statute, this is what the app does. ---
  {
    section: 'privacy',
    contentVersion: BUNDLED_CONTENT_VERSION,
    requiresCitation: true,
    sources: [
      {
        source: 'BlackStory',
        label: 'Full privacy policy (web)',
        href: 'https://blackstory.app/privacy',
      },
    ],
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
  // --- Terms (condensed from apps/web/src/app/terms/TermsSections.tsx). The license, the
  // correction/copyright process, and the affiliate disclosure are the sections a reader is
  // least able to look up over a network round trip, so they are carried in full here rather
  // than left to the web link. Everything else is compressed. ---
  {
    section: 'terms',
    contentVersion: BUNDLED_CONTENT_VERSION,
    requiresCitation: true,
    sources: [
      {
        source: 'BlackStory',
        label: 'Full terms notice (web)',
        href: 'https://blackstory.app/terms',
      },
    ],
    page: {
      slug: 'terms',
      title: 'Terms of service',
      dek: 'What the app is, what the license permits, and where a correction or a copyright complaint goes.',
      publishedAt: '2026-09-13',
      eraLabel: '',
      placeLabel: '',
      relatedEntityIds: [],
      relatedFactIds: [],
      body: [
        {
          heading: 'What this covers',
          paragraphs: [
            'This covers the BlackStory app and the archive it publishes. It is a notice, not a contract: opening the app never asks you to agree to anything, and nothing below is written to work only if you had. BlackStory is run by Gerald Dagher, an individual — there is no company behind it.',
            'BlackStory is not a government register, a court file, or an archive of record, and a page here proves nothing on its own. Nothing published is legal advice, and nothing certifies a lineage or a claim of descent. Where a record cites a source, the source is the authority; the record is the finding aid that points you to it.',
          ],
        },
        {
          heading: 'Reusing what BlackStory writes',
          paragraphs: [
            'The writing on BlackStory is published under Creative Commons Attribution 4.0 International (CC BY 4.0). Copy it, republish it, translate it, quote it, build something else on top of it, commercially or not. The condition is credit: name BlackStory, link back to the page you took it from, and say if you changed it.',
            'That license reaches the writing and the arrangement, not the facts themselves — a date, a name, a place belongs to nobody, and you may use it with no credit owed. The license also does not reach material BlackStory does not own: photographs, scanned documents, and map tiles come from third parties on their own terms, named on the record that displays them.',
          ],
        },
        {
          heading: 'Corrections, and a record about you',
          paragraphs: [
            'A correction, a research lead, or an abuse report goes through the in-app forms. Nothing sent is published as sent, and nothing sent is visible to other readers. A person reads it, you get a receipt code to check the outcome, and one appeal if a closed correction still looks wrong. If a record changes, the change is published in the errata log rather than swapped in quietly.',
            'If a record is about you, say so when you flag it, or write to me@geralddagher.com directly. A living-person concern is flagged as one from the start and read by a person, not a filter.',
          ],
        },
        {
          heading: 'Copyright complaints',
          paragraphs: [
            'If something published here is yours, write to me@geralddagher.com. Say what the material is, the address of the page it is on, what right you hold in it, and how to reach you.',
            'I acknowledge a copyright complaint within 72 hours and reach a decision within 30 days. Material found to be infringing is removed. If I think the use was lawful I will say so and say why, and the material stays up while that is settled.',
          ],
        },
        {
          heading: 'Accuracy, liability, and affiliate links',
          paragraphs: [
            'The research here is provided as it stands, without a warranty of completeness or currency. Sources sit on the record so it can be checked, and records change as evidence changes. A disclaimer does not make a wrong record less wrong — the fix is a correction, not this sentence.',
            'BlackStory is free to use and run by one person rather than a company. To the extent the law allows, I am not liable for indirect or consequential loss arising from use of the app.',
            'Some book pages link to Bookshop.org through an affiliate program, and a purchase made through one of those links pays a commission. The affiliate relationship never decides which books appear or what a record says about them.',
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
          heading: '2026-07-15 · Correction · Dunbar founding year',
          paragraphs: [
            'Corrected a caption that implied the 1916 renaming was the school’s founding. The founding date (1870) and the two earlier names now appear on the same timeline.',
          ],
        },
        {
          heading: '2026-06-02 · Update · Landmark listing added',
          paragraphs: [
            'Added the 1975 D.C. Inventory of Historic Sites listing as a distinct, dated event separate from the 2013 building.',
          ],
        },
      ],
    },
  },

  // --- Support (condensed from apps/web/src/app/support/page.tsx) -------------------------------
  {
    section: 'support',
    contentVersion: BUNDLED_CONTENT_VERSION,
    requiresCitation: true,
    sources: [
      {
        source: 'BlackStory',
        label: 'Full support page (web)',
        href: 'https://blackstory.app/support',
      },
    ],
    page: {
      slug: 'support',
      title: 'Support',
      dek: 'How to get an answer, and how long it should take.',
      publishedAt: '2026-07-01',
      eraLabel: '',
      placeLabel: '',
      relatedEntityIds: [],
      relatedFactIds: [],
      body: [
        {
          paragraphs: [
            'BlackStory is one person’s archive of Black history, tied to the places it happened. If something in a record is wrong, corrections is the fastest way in: it is moderated, it gives you a receipt code, and nothing is published as submitted.',
          ],
        },
        {
          heading: 'Ways to get help',
          paragraphs: [
            'Report a correction to say a published record is wrong, or point at evidence it is missing. Submissions enter moderated review, and nothing changes publicly until a person accepts it.',
            'Read the methodology for the source rules, confidence grades, and map dignity limits. Browse the errata log for corrections, clarifications, and updates already applied, newest first.',
          ],
        },
        {
          heading: 'Reach me',
          paragraphs: [
            'For anything the corrections form has no field for (how the archive is run, a privacy request, an accessibility barrier that keeps you out of a page), write to me directly: me@geralddagher.com.',
            'Most privacy questions are already answered on the Privacy page. One person builds and runs BlackStory, so a reply can take a few days. I read everything that comes in, and I’ll keep this running for as long as I can.',
          ],
        },
      ],
    },
  },
];

export function listCatalogEntries(section: CatalogSectionId): readonly ContentEntry[] {
  return CONTENT_CATALOG.filter((entry) => entry.section === section);
}

export function findCatalogEntry(
  section: CatalogSectionId,
  slug: string,
): ContentEntry | undefined {
  return CONTENT_CATALOG.find((entry) => entry.section === section && entry.page.slug === slug);
}
