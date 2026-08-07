"""Build packages/ops-data/fixtures/articles/presidents.ts from the verified research JSON.

    python3 packages/ops-data/scripts/build-presidents-fixture.py \
      packages/ops-data/fixtures/articles/presidents.ts

Reads every group-*.json in ../fixtures/articles/presidents-research/. Those files are the
Layer-1 research record: each fact with the URL actually fetched for it and a verbatim
quote, per docs/methodology/chapter-fact-validation.md. They are kept in the repo because
the fixture is generated from them — without them a sentence in a published entry has no
traceable provenance, and there would be no way to rebuild after a correction.

Reference discipline: the article schema's citation-integrity check requires every
reference to be *used* and every inline marker to *resolve*, so this only emits a
reference when something actually cites it. Call-out sources are cited in their bullet;
president-level sources are cited on the context paragraph. Nothing is emitted that the
research did not carry a fetched source for.
"""
import json, re, sys, glob, os

# Hosts the shared source-tier registry (packages/domain/src/provenance/source-tiers.ts)
# does not classify at T3 or better: user-editable transcriptions, a personal academic
# site, a student paper, and a wire story. A published article cannot cite T4, so these
# are dropped rather than laundered into the registry to make the build pass. A call-out
# left with no source at all is dropped with them.
UNTRUSTED_HOSTS = (
    "wikisource.org",
    "famous-trials.com",
    "thecrimson.com",
    "cnn.com",
    "wordpress.com",  # a presidential library's blog is still a blogging platform host
)

ERA_TAGS = [
    (1, 6, "Founding era"),
    (7, 15, "Antebellum"),
    (16, 17, "Civil War"),
    (18, 24, "Reconstruction"),
    (25, 32, "Jim Crow era"),
    (33, 39, "Civil rights era"),
    (40, 99, "Modern era"),
]

ORDINAL_SUFFIX = lambda n: "th" if 11 <= n % 100 <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")


def era_tag(number: int) -> str:
    for lo, hi, label in ERA_TAGS:
        if lo <= number <= hi:
            return label
    return "Modern era"


def slugify(text: str) -> str:
    text = text.lower().replace(".", "").replace("'", "").replace("\u2019", "")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return re.sub(r"-+", "-", text).strip("-")


def unique_id(preferred: str, used: set) -> str:
    """First free id derived from `preferred`. Adds to `used` and returns it."""
    base = slugify(preferred) or "source"
    base = "-".join(base.split("-")[:6]) or "source"
    candidate, n = base, 2
    while candidate in used:
        candidate = f"{base}-{n}"
        n += 1
    used.add(candidate)
    return candidate


def standalone(text: str) -> str:
    """Strip publisher self-reference from research prose.

    The researchers wrote notes like "this project could not verify X". That is the
    publisher talking about its own work, which `gateStandaloneProse` rejects: a reader
    arriving from search has no idea what "this project" is. "This entry" refers to the
    piece in front of them, which is ordinary essay voice and stays.
    """
    text = re.sub(r"\bThis project\b", "This entry", text)
    text = re.sub(r"\bthis project\b", "this entry", text)
    return text


def esc(text: str) -> str:
    return standalone(text).replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").strip()


def build(president: dict) -> str:
    number = president["number"]
    name = president["name"]
    slug = slugify(name)
    used_ids: set = set()
    by_url: dict = {}
    references: list = []

    def register(source: dict) -> str:
        """One reference per distinct URL; the same source cited twice reuses its id."""
        url = source["url"]
        if url in by_url:
            return by_url[url]
        rid = unique_id(source.get("id") or source.get("label") or url, used_ids)
        by_url[url] = rid
        references.append({"id": rid, "label": source.get("label", url), "url": url})
        return rid

    def usable(source: dict) -> bool:
        url = source.get("url") or ""
        return bool(url) and not any(host in url for host in UNTRUSTED_HOSTS)

    # Context paragraph carries the president-level sources.
    para_refs = [register(s) for s in president.get("sources", []) if usable(s)]
    paragraph = president["paragraph"].strip()
    if para_refs:
        paragraph = paragraph.rstrip() + "".join(f"[ref:{r}]" for r in para_refs)

    callouts = []
    for callout in president.get("callouts", []):
        ids = [register(s) for s in callout.get("sources", []) if usable(s)]
        if not ids:
            continue  # a call-out with no fetched source does not ship
        callouts.append(callout["text"].strip().rstrip() + "".join(f"[ref:{i}]" for i in ids))

    body = [f"{{ type: 'paragraph', text: '{esc(paragraph)}' }}"]
    if callouts:
        body.append("{ type: 'heading', level: 2 as const, text: 'The record' }")
        items = ",\n        ".join(f"'{esc(c)}'" for c in callouts)
        body.append(
            "{\n        type: 'list' as const,\n        style: 'bullet' as const,\n        items: [\n        "
            + items
            + ",\n        ],\n      }"
        )

    personal = (president.get("personalRecord") or "").strip()
    if personal:
        body.append("{ type: 'heading', level: 2 as const, text: 'Personal record' }")
        body.append(f"{{ type: 'paragraph', text: '{esc(personal)}' }}")

    disputes = [d for d in (president.get("disputes") or []) if d and d.strip()]
    if disputes:
        body.append("{ type: 'heading', level: 2 as const, text: 'Where the record disagrees' }")
        for dispute in disputes:
            body.append(f"{{ type: 'paragraph', text: '{esc(dispute)}' }}")

    portrait = president.get("portrait") or {}
    hero = ""
    if portrait.get("url"):
        hero = (
            "  heroImage: {\n"
            f"    url: '{esc(portrait['url'])}',\n"
            f"    alt: '{esc(portrait.get('alt', name))}',\n"
            f"    credit: '{esc(portrait.get('credit', 'Public domain.'))}',\n"
            "    rightsStatus: 'public_domain' as const,\n"
            "  },\n"
        )

    refs = ",\n    ".join(
        "{\n      id: '%s',\n      label: '%s',\n      url: '%s',\n    }" % (r["id"], esc(r["label"]), esc(r["url"]))
        for r in references
    )
    ordinal = f"{number}{ORDINAL_SUFFIX(number)} president"

    return f"""  {{
    id: 'article_potus_{number:02d}_{slug.replace('-', '_')}',
    slug: '{slug}',
    kind: 'article' as const,
    title: '{esc(name)}',
    summary: '{esc(president['summary'])}',
    eraLabel: '{esc(president['termLabel'])}',
    placeLabel: 'United States',
    publishedAt: '2026-08-07',
    status: 'review' as const,
    series: {{
      id: 'presidents',
      label: 'The presidents on the record',
      position: {number},
      positionLabel: '{ordinal}',
    }},
    tags: ['{era_tag(number)}'],
{hero}    relatedEntityIds: [],
    references: [
    {refs},
    ],
    body: [
      {',\n      '.join(body)},
    ],
  }}"""


def main() -> None:
    out_dir = sys.argv[1]
    presidents = []
    research_dir = os.path.join(
        os.path.dirname(__file__), "..", "fixtures", "articles", "presidents-research"
    )
    for path in sorted(glob.glob(os.path.join(research_dir, "group-*.json"))):
        with open(path) as handle:
            presidents.extend(json.load(handle)["presidents"])
    presidents.sort(key=lambda p: p["number"])

    entries = ",\n".join(build(p) for p in presidents)
    header = '''/**
 * "The presidents on the record" — one record entry per presidency, covering what the
 * documented federal record shows about that administration and Black Americans.
 *
 * Kind is `article`, not `chapter`: each entry is a paragraph of context plus call-outs,
 * where a call-out is one dated, documented act (a signature, a veto, an executive order,
 * an appointment, a refusal) carrying its own citation. That shape is deliberate. These
 * entries are read against each other, so they have to be comparable, and a bullet lifted
 * out of the page has to arrive with its receipt attached — `gateCalloutCitations` in
 * packages/ops-data/scripts/articles.ts enforces exactly that.
 *
 * Sourcing follows docs/methodology/chapter-fact-validation.md: every fact was gathered
 * from fetched pages, never from model memory, with two independent sources from different
 * institutions where the record allows it and at least one primary or official source.
 * Where the record is thin, the entry is short; where reputable sources disagree, both are
 * shown under "Where the record disagrees" rather than resolved into one claim the record
 * does not support. Portraits are federal works or pre-1929 images in the public domain.
 *
 * GENERATED. Rebuild rather than hand-edit: the research JSON is the source of truth, and
 * a hand edit here would silently detach a sentence from the source that was fetched for it.
 */

export const presidentArticles = [
'''
    footer = "\n];\n\nexport default presidentArticles;\n"
    with open(out_dir, "w") as handle:
        handle.write(header + entries + footer)
    print(f"wrote {len(presidents)} presidents")


main()
