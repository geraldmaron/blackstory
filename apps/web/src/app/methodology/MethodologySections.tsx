/**
 * Methodology v6 edition beats: mission, evidence pipeline, research flow, definitions,
 * source hierarchy, verification standards, and operations accountability.
 */
import React from 'react';
import Link from 'next/link';
import { Notice } from '@repo/ui';
import {
  FACT_CONFIDENCE_DEFINITIONS,
  type FactConfidenceGrade,
  type FactStatus,
} from '@repo/domain/facts';
import {
  CULTURAL_FIGURE_NOTABILITY_CALIBRATION_NOTE,
  NOTABILITY_CRITERIA,
  NOTABILITY_RUBRIC,
} from '@repo/domain/entity-status';
import {
  ENTITY_STATUS_VOCABULARY,
  FACT_STATUS_LIFECYCLE_DEFINITIONS,
  IFCN_COMMITMENTS,
  PREBUNK_TECHNIQUE_FRAMES,
  SOURCE_HIERARCHY_LEVELS,
  TRUST_PROJECT_INDICATORS,
} from '../../lib/trust/domain-trust';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import { humanizeToken, mapConfidenceToUiLevel } from '../../components/facts/format';
import { ConfidenceMark } from '../../components/map-experience/ConfidenceMark';
import {
  ResearchPipelineSketch,
  SourceTypesSketch,
} from '../../components/trust/ResearchPipelineSketch';
import { TrustSiteDisclaimer } from '../../components/trust/TrustSiteDisclaimer';
import {
  METHODOLOGY_DIGNITY_LINE,
  METHODOLOGY_INTRO_LEDE,
  METHODOLOGY_MISSION_BEATS,
  METHODOLOGY_PAGE_SECTIONS,
  METHODOLOGY_PUBLISH_RULES,
} from './methodology-copy';
import { methodologyEditionPanelClassName } from './methodology-panel-chrome';

const VERIFICATION_STEPS = [
  'Identify primary sources closest to the event or record creation.',
  'Cross-check against independent secondary scholarship where primaries are sparse.',
  'Document contradictions in confidence notes and counter-claims rather than hiding them.',
  'Append every change to the revision log with a mandatory edit summary.',
] as const;

const DIGNITY_RULES = [
  'Public precision runs from country through campus or institution; never street addresses or exact residence coordinates for living people.',
  'Points render no sharper than stored public precision. A coarsened point is never labeled as an exact address.',
  'No red or alarm hues for violence-adjacent records; no crime-heat rendering. Color is never the only signal.',
  'Unknown living status is treated as living. Current residential addresses do not appear on public pages or hand-offs.',
  'Hard history is documented where the sources support it, but presence (people, institutions, places across time) is the default lens, not a trauma-first feed.',
] as const;

const LIMITATION_RULES = [
  'Coverage is uneven across places and eras. Absence on the map is not proof that nothing happened; it may mean sources have not cleared the publish gate yet.',
  'Single-source facts are published only with an explicit confidence note explaining why.',
  'External statistics (census, ACS, voluntary reporting series) carry their own coverage limits; participation and suppression are part of the reading, not optional footnotes.',
  'Link rot and missing archives happen. Where a web source was captured, the capture travels with the citation; where it was not, the gap is visible.',
] as const;

const INTERNAL_FACT_STATUSES = new Set<FactStatus>(['draft', 'under_review']);

function summarizeDefinition(text: string, maxLength = 128): { readonly summary: string; readonly hasMore: boolean } {
  const trimmed = text.trim();
  const sentenceMatch = trimmed.match(/^[^.!?]+[.!?]/);
  const firstSentence = sentenceMatch?.[0]?.trim() ?? trimmed;
  if (firstSentence.length <= maxLength && firstSentence === trimmed) {
    return { summary: trimmed, hasMore: false };
  }
  const summary =
    firstSentence.length <= maxLength
      ? firstSentence
      : `${trimmed.slice(0, maxLength - 1).trim()}…`;
  return { summary, hasMore: summary !== trimmed };
}

function TermChip({
  children,
  variant,
}: {
  readonly children: React.ReactNode;
  readonly variant?: 'default' | 'internal' | 'public';
}) {
  return (
    <span
      className={[
        'ds-methodology-edition__chip',
        variant === 'internal' ? 'ds-methodology-edition__chip--internal' : '',
        variant === 'public' ? 'ds-methodology-edition__chip--public' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}

function LedgerCard({
  term,
  definition,
  meta,
  termVariant,
}: {
  readonly term: string;
  readonly definition: string;
  readonly meta?: string;
  readonly termVariant?: 'default' | 'internal' | 'public';
}) {
  const { summary, hasMore } = summarizeDefinition(definition);

  return (
    <article className="ds-methodology-edition__ledger-item">
      <div className="ds-methodology-edition__ledger-head">
        <TermChip {...(termVariant ? { variant: termVariant } : {})}>{term}</TermChip>
        {meta ? <span className="ds-methodology-edition__ledger-meta">{meta}</span> : null}
      </div>
      <p className="ds-methodology-edition__ledger-summary">{summary}</p>
      {hasMore ? (
        <details className="ds-methodology-edition__ledger-detail">
          <summary>Read full definition</summary>
          <p>{definition}</p>
        </details>
      ) : null}
    </article>
  );
}

function LedgerStack({
  items,
  className,
}: {
  readonly items: readonly {
    readonly id: string;
    readonly term: string;
    readonly definition: string;
    readonly meta?: string;
    readonly termVariant?: 'default' | 'internal' | 'public';
  }[];
  readonly className?: string;
}) {
  return (
    <div className={['ds-methodology-edition__ledger', className ?? ''].filter(Boolean).join(' ')}>
      {items.map((item) => (
        <LedgerCard
          key={item.id}
          term={item.term}
          definition={item.definition}
          {...(item.meta ? { meta: item.meta } : {})}
          {...(item.termVariant ? { termVariant: item.termVariant } : {})}
        />
      ))}
    </div>
  );
}

function ConfidenceGradeCard({
  grade,
  definition,
}: {
  readonly grade: FactConfidenceGrade;
  readonly definition: string;
}) {
  const uiLevel = mapConfidenceToUiLevel(grade);
  const label = humanizeToken(grade);
  const { summary, hasMore } = summarizeDefinition(definition);

  return (
    <article className="ds-methodology-edition__grade-card">
      <div className="ds-methodology-edition__grade-head">
        <ConfidenceMark tier={uiLevel} labeled />
        <span className="ds-methodology-edition__grade-label">{label}</span>
      </div>
      <p className="ds-methodology-edition__grade-summary">{summary}</p>
      {hasMore ? (
        <details className="ds-methodology-edition__ledger-detail">
          <summary>Read full grade definition</summary>
          <p>{definition}</p>
        </details>
      ) : null}
    </article>
  );
}

function RuleStrip({
  rules,
  label,
}: {
  readonly rules: readonly string[];
  readonly label: string;
}) {
  return (
    <ol className="ds-methodology-edition__rule-strip" aria-label={label}>
      {rules.map((rule) => (
        <li key={rule} className="ds-methodology-edition__rule-row">
          <span className="ds-methodology-edition__rule-text">{rule}</span>
        </li>
      ))}
    </ol>
  );
}

function SourceTierStack({
  entries,
}: {
  readonly entries: readonly { readonly term: string; readonly definition: string }[];
}) {
  return (
    <ol className="ds-methodology-edition__tier-stack">
      {entries.map((entry, index) => {
        const { summary, hasMore } = summarizeDefinition(entry.definition);
        return (
          <li key={entry.term} className="ds-methodology-edition__tier-item">
            <div className="ds-methodology-edition__tier-head">
              <span className="ds-methodology-edition__tier-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <TermChip>{entry.term}</TermChip>
            </div>
            <p className="ds-methodology-edition__ledger-summary">{summary}</p>
            {hasMore ? (
              <details className="ds-methodology-edition__ledger-detail">
                <summary>Read full tier definition</summary>
                <p>{entry.definition}</p>
              </details>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function EditionHeader({
  index,
  kicker,
  title,
  lede,
  headingId,
}: {
  readonly index: string;
  readonly kicker: string;
  readonly title: React.ReactNode;
  readonly lede?: string;
  readonly headingId: string;
}) {
  return (
    <header className="ds-methodology-edition__header">
      <span className="ds-methodology-edition__index" aria-hidden="true">
        {index}
      </span>
      <div>
        <p className="ds-methodology-edition__kicker">{kicker}</p>
        <h2 className="ds-methodology-edition__title" id={headingId}>
          {title}
        </h2>
        {lede ? <p className="ds-methodology-edition__lede">{lede}</p> : null}
      </div>
    </header>
  );
}

export function MethodologySections() {
  const notabilityItems = NOTABILITY_CRITERIA.map((criterion) => ({
    id: criterion,
    term: humanizeToken(criterion),
    definition: NOTABILITY_RUBRIC[criterion],
  }));

  const lifecycleItems = Object.entries(FACT_STATUS_LIFECYCLE_DEFINITIONS).map(([status, definition]) => ({
    id: status,
    term: humanizeToken(status),
    definition,
    meta: INTERNAL_FACT_STATUSES.has(status as FactStatus) ? 'Off public surfaces' : 'Public projection',
    termVariant: INTERNAL_FACT_STATUSES.has(status as FactStatus) ? ('internal' as const) : ('public' as const),
  }));

  const entityStatusItems = [
    ...ENTITY_STATUS_VOCABULARY.place_like.map((entry) => ({
      id: `place-${entry.value}`,
      term: `Place · ${humanizeToken(entry.value)}`,
      definition: entry.definition,
    })),
    ...ENTITY_STATUS_VOCABULARY.law.map((entry) => ({
      id: `law-${entry.value}`,
      term: `Law · ${humanizeToken(entry.value)}`,
      definition: entry.definition,
    })),
    ...ENTITY_STATUS_VOCABULARY.movement.map((entry) => ({
      id: `movement-${entry.value}`,
      term: `Movement · ${humanizeToken(entry.value)}`,
      definition: entry.definition,
    })),
  ];

  const sourceEntries = SOURCE_HIERARCHY_LEVELS.map((level) => ({
    term: humanizeToken(level.tier),
    definition: level.definition,
  }));

  const confidenceGrades = Object.keys(FACT_CONFIDENCE_DEFINITIONS) as FactConfidenceGrade[];

  const trustIndicatorItems = TRUST_PROJECT_INDICATORS.map((indicator) => ({
    id: indicator.id,
    term: indicator.title,
    definition: indicator.summary,
    meta: indicator.schemaProperty,
  }));

  const ifcnItems = IFCN_COMMITMENTS.map((commitment, index) => ({
    id: `ifcn-${index}`,
    term: commitment.title,
    definition: commitment.body,
  }));

  return (
    <>
      <article className={methodologyEditionPanelClassName('intro')}>
        <header className="ds-methodology-edition__header">
          <span className="ds-methodology-edition__index" aria-hidden="true">
            00
          </span>
          <div>
            <p className="ds-methodology-edition__kicker">Transparency</p>
            <h1 className="ds-methodology-edition__title" id="methodology-intro">
              How we <em>work</em>.
            </h1>
            <p className="ds-methodology-edition__lede">{METHODOLOGY_INTRO_LEDE}</p>
            <div className="ds-methodology-edition__disclaimer">
              <TrustSiteDisclaimer />
            </div>
            <p className="ds-methodology-edition__actions">
              <Link className="ds-cta ds-cta--solid" href="/explore">
                Open the map
              </Link>
              <Link className="ds-cta ds-cta--quiet" href="/about">
                About BlackStory
              </Link>
            </p>
            <p className="ds-methodology-edition__credit">
              Archive mosaic · symbolic atmosphere · decorative gutter tiles only.{' '}
              <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
            </p>
          </div>
        </header>
        <nav className="ds-methodology-edition__nav" aria-labelledby="methodology-toc-title">
          <p className="ds-methodology-edition__nav-title" id="methodology-toc-title">
            On this page
          </p>
          <ul className="ds-methodology-edition__nav-list">
            {METHODOLOGY_PAGE_SECTIONS.map((section) => (
              <li key={section.id}>
                <a className="ds-methodology-edition__nav-link" href={`#${section.id}`}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </article>

      <article
        className={methodologyEditionPanelClassName('mission')}
        aria-labelledby="mission-method"
        id="mission"
      >
        <EditionHeader
          index="01"
          kicker="Mission & scope"
          title="Released projections with receipts"
          lede="BlackStory publishes place-connected Black history with provenance, confidence grades, and living-person protections. We document what primary and secondary sources support, state what they do not, and preserve disagreements instead of collapsing them into a single winner."
          headingId="mission-method"
        />
        <ul className="ds-methodology-edition__mission-grid">
          {METHODOLOGY_MISSION_BEATS.map((beat) => (
            <li key={beat.kicker} className="ds-methodology-edition__mission-item">
              <p className="ds-methodology-edition__mission-kicker">{beat.kicker}</p>
              <p className="ds-methodology-edition__mission-body">{beat.body}</p>
            </li>
          ))}
        </ul>
      </article>

      <article
        className={methodologyEditionPanelClassName('evidence')}
        aria-labelledby="evidence-pipeline-method"
        id="evidence-pipeline"
      >
        <EditionHeader
          index="02"
          kicker="Evidence before assertion"
          title="How records reach the map."
          lede="Discovery finds candidates. People verify. The publish gate decides what reaches the public record. Models never write it alone."
          headingId="evidence-pipeline-method"
        />
        <div className="ds-methodology-edition__method-compose">
          <div className="ds-methodology-edition__pipeline-wrap">
            <ResearchPipelineSketch compact />
          </div>
          <ol className="ds-methodology-edition__publish-rules">
            {METHODOLOGY_PUBLISH_RULES.map((item, index) => (
              <li key={item.title}>
                <span className="ds-methodology-edition__publish-num" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="ds-methodology-edition__publish-title">{item.title}</p>
                  <p className="ds-methodology-edition__publish-desc">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="ds-methodology-edition__dignity-line">
          <strong>Dignity</strong>
          {METHODOLOGY_DIGNITY_LINE}
        </p>
      </article>

      <article
        className={methodologyEditionPanelClassName('pipeline')}
        aria-labelledby="research-pipeline-method"
        id="research-pipeline"
      >
        <EditionHeader
          index="03"
          kicker="How research moves"
          title="From intake to publish gate"
          lede="Discovery tools find candidates; they never substitute for verification. Fragments aggregate, models assist research on private surfaces, and human review decides what reaches the public record."
          headingId="research-pipeline-method"
        />
        <div className="ds-methodology-edition__pipeline-full">
          <ResearchPipelineSketch />
        </div>
      </article>

      <article
        className={methodologyEditionPanelClassName('how-to-read')}
        aria-labelledby="how-to-read-method"
        id="how-to-read"
      >
        <EditionHeader
          index="04"
          kicker="How to read a record"
          title="Check the evidence yourself"
          lede="Historical records get challenged in predictable ways: out-of-context quotes, impossible documentation demands, or attacks on the messenger instead of the evidence. Name the technique, then follow the citation chain."
          headingId="how-to-read-method"
        />
        <ul className="ds-methodology-edition__technique-grid">
          {PREBUNK_TECHNIQUE_FRAMES.map((frame) => (
            <li key={frame.id} className="ds-methodology-edition__technique">
              <p className="ds-methodology-edition__technique-name">{frame.technique}</p>
              <p className="ds-methodology-edition__technique-action">{frame.readerAction}</p>
            </li>
          ))}
        </ul>
      </article>

      <article
        className={methodologyEditionPanelClassName('definitions')}
        aria-labelledby="definitions-method"
        id="definitions"
      >
        <EditionHeader
          index="05"
          kicker="Definitions & inclusion"
          title="Shared vocabulary"
          lede="Precision in definitions lets a reader compare this archive to others without talking past each other. Inclusion is never a popularity contest; every entity needs at least one documented notability basis."
          headingId="definitions-method"
        />

        <h3 className="ds-methodology-edition__subhead">Notability basis (per kind)</h3>
        <LedgerStack items={notabilityItems} />
        <Notice
          className="ds-methodology-edition__callout"
          tone="warning"
          title="Cultural-figure calibration"
        >
          {CULTURAL_FIGURE_NOTABILITY_CALIBRATION_NOTE}
        </Notice>

        <h3 className="ds-methodology-edition__subhead">Fact record status lifecycle</h3>
        <Notice className="ds-methodology-edition__callout" tone="warning" title="Public projection gate">
          Only published (and later corrected, superseded, or deprecated) facts appear on public
          surfaces. Draft and under-review work stay off the public projection and search index.
        </Notice>
        <LedgerStack items={lifecycleItems} />

        <h3 className="ds-methodology-edition__subhead">Entity status vocabularies</h3>
        <LedgerStack items={entityStatusItems} />
      </article>

      <article
        className={methodologyEditionPanelClassName('sources')}
        aria-labelledby="source-hierarchy-method"
        id="sources"
      >
        <EditionHeader
          index="06"
          kicker="Source hierarchy"
          title="Proximity to the event"
          lede="Sources are ranked by proximity to the event and by independence. Discovery tools help find candidates; they do not substitute for verification."
          headingId="source-hierarchy-method"
        />
        <div className="ds-methodology-edition__split">
          <SourceTierStack entries={sourceEntries} />
          <SourceTypesSketch />
        </div>
      </article>

      <article
        className={methodologyEditionPanelClassName('standards')}
        aria-labelledby="standards-method"
        id="standards"
      >
        <EditionHeader
          index="07"
          kicker="Verification & limits"
          title="Standards you can audit"
          headingId="standards-method"
        />

        <div className="ds-methodology-edition__policy-block" id="verification">
          <h3 className="ds-methodology-edition__policy-title" id="verification-method">
            Verification & triangulation
          </h3>
          <p className="ds-methodology-edition__policy-lede">
            Every published fact passes an independent citation-completeness gate before release.
            Triangulation means at least two independent lineages before corroborated grade;
            syndicated copies do not inflate scores.
          </p>
          <RuleStrip label="Verification steps" rules={VERIFICATION_STEPS} />
        </div>

        <div className="ds-methodology-edition__policy-block" id="confidence">
          <h3 className="ds-methodology-edition__policy-title" id="confidence-method">
            Confidence grades
          </h3>
          <p className="ds-methodology-edition__policy-lede">
            Confidence is never color alone; every grade carries a glyph, a text label, and a
            published definition. Crime statistics never enter the composite confidence score.
          </p>
          <div className="ds-methodology-edition__grade-grid">
            {confidenceGrades.map((grade) => (
              <ConfidenceGradeCard
                key={grade}
                grade={grade}
                definition={FACT_CONFIDENCE_DEFINITIONS[grade]}
              />
            ))}
          </div>
        </div>

        <div className="ds-methodology-edition__policy-block" id="dignity">
          <h3 className="ds-methodology-edition__policy-title" id="dignity-method">
            Geographic precision & map dignity
          </h3>
          <p className="ds-methodology-edition__policy-lede">
            Place is the product&apos;s organizing idea, and also where harm is easiest to cause.
            Public maps follow dignity rules that are load-bearing, not decorative.
          </p>
          <RuleStrip label="Map dignity rules" rules={DIGNITY_RULES} />
        </div>

        <div className="ds-methodology-edition__policy-block" id="limitations">
          <h3 className="ds-methodology-edition__policy-title" id="limitations-method">
            Known limitations & gaps
          </h3>
          <p className="ds-methodology-edition__policy-lede">
            An archive of sourced facts will contain errors. Every correction is logged publicly
            and preserved in the record&apos;s history; nothing is silently edited.
          </p>
          <RuleStrip label="Known limitations" rules={LIMITATION_RULES} />
        </div>
      </article>

      <article
        className={methodologyEditionPanelClassName('operations')}
        aria-labelledby="operations-method"
        id="operations"
      >
        <EditionHeader
          index="08"
          kicker="Operations & accountability"
          title="How the archive stays current"
          lede="Corrections, funding disclosures, editorial roles, and external alignment frameworks: the operational layer behind the evidence bar."
          headingId="operations-method"
        />

        <div className="ds-methodology-edition__operations-grid">
          <article className="ds-methodology-edition__operations-item" id="cadence">
            <p className="ds-methodology-edition__operations-kicker">Update cadence</p>
            <h3 className="ds-methodology-edition__operations-title" id="cadence-method">
              Corrections ship when verified
            </h3>
            <p className="ds-methodology-edition__operations-body">
              Routine content reviews run quarterly; present-day advisories carry their own review
              dates on each record. Major methodology changes receive an editor&apos;s note in the{' '}
              <Link href="/errata">errata log</Link>.
            </p>
          </article>

          <article className="ds-methodology-edition__operations-item" id="report-error">
            <p className="ds-methodology-edition__operations-kicker">Corrections lane</p>
            <h3 className="ds-methodology-edition__operations-title" id="report-error-method">
              How to report an error
            </h3>
            <p className="ds-methodology-edition__operations-body">
              Use the <Link href="/corrections">corrections lane</Link> to challenge a published
              record, suggest missing evidence, or report a precision issue. Submissions enter a
              restricted review queue; nothing changes publicly until it passes independent
              verification. You receive a receipt code to track status.
            </p>
          </article>

          <article className="ds-methodology-edition__operations-item" id="funding">
            <p className="ds-methodology-edition__operations-kicker">Independence</p>
            <h3 className="ds-methodology-edition__operations-title" id="funding-method">
              Funding & editorial firewall
            </h3>
            <p className="ds-methodology-edition__operations-body" id="independence">
              BlackStory is an independent editorial project. Funding sources, when applicable, are
              listed here and updated when they change. No funder receives advance editorial review
              or veto over published records. When formal funding disclosures apply, they will
              appear in this section with dates.
            </p>
          </article>

          <article className="ds-methodology-edition__operations-item" id="masthead">
            <p className="ds-methodology-edition__operations-kicker">Masthead</p>
            <h3 className="ds-methodology-edition__operations-title" id="masthead-method">
              Named accountability
            </h3>
            <p className="ds-methodology-edition__operations-body">
              Editorial accountability is named by role, not hidden behind an anonymous brand
              voice. Public bios link here as the team publishes them.
            </p>
            <ul className="ds-methodology-edition__operations-list">
              <li>Editorial lead: methodology, corrections policy, and publish gate</li>
              <li>Research lead: source verification and citation completeness</li>
              <li>Platform lead: projection integrity and security posture</li>
            </ul>
          </article>

          <article className="ds-methodology-edition__operations-item" id="transparency">
            <p className="ds-methodology-edition__operations-kicker">Trust Project</p>
            <h3 className="ds-methodology-edition__operations-title" id="transparency-method">
              Transparency indicators
            </h3>
            <p className="ds-methodology-edition__operations-body">
              We adopt the eight transparency practices and their schema.org vocabulary (CC-BY-SA)
              without using any trademarked program name or badge. Each indicator maps to a
              published policy URL on this site.
            </p>
            <LedgerStack items={trustIndicatorItems} />
          </article>

          <article className="ds-methodology-edition__operations-item" id="ifcn">
            <p className="ds-methodology-edition__operations-kicker">IFCN alignment</p>
            <h3 className="ds-methodology-edition__operations-title" id="ifcn-method">
              Fact-checking commitments
            </h3>
            <p className="ds-methodology-edition__operations-body">
              The five International Fact-Checking Network commitments below are reproduced as
              editorial alignment. BlackStory is not a paid IFCN signatory; the badge requires
              signatory status. The commitment language is public and guides our corrections and
              verification posture.
            </p>
            <LedgerStack items={ifcnItems} />
          </article>
        </div>
      </article>

      <article
        className={methodologyEditionPanelClassName('close')}
        aria-labelledby="next-method"
        id="next"
      >
        <EditionHeader
          index="09"
          kicker="Keep going"
          title="Related trust surfaces"
          headingId="next-method"
        />
        <nav className="ds-methodology-edition__close-links" aria-label="Related pages">
          <Link href="/about">About BlackStory</Link>
          <Link href="/corrections">Corrections</Link>
          <Link href="/errata">Errata</Link>
          <Link href="/explore">Open the map</Link>
        </nav>
      </article>
    </>
  );
}
