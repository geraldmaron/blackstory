# The source register

## What it is

`packages/ops-data/scripts/lib/source-register.json` is a list of hosts the pipeline recognizes
as institutions, and, for each one, the record that says why. It is data, produced by a tool that
checks external authority registries, not a list anyone types by hand.

The confidence engine reads a source's class off its URL. A `.gov` or `.mil` host is a
`government_record` (authority 0.95). A recognized institution is `reputable_secondary` (0.75). A
newspaper is `news_reportage` (0.55). Anything the classifier cannot place is `unknown`, worth
0.2.

That last number is the reason this exists. Before the register, the only way off `unknown` was
a hand-curated list of host suffixes in `packages/ops-data/scripts/lib/tier1-sources.ts`. A claim
sourced to the Academy of American Poets, the Schomburg Center or a state historical society was
not on that list, so it scored 0.583 — below a claim from a crowd-edited roadside-marker database
at 0.720 — and appending one of those sources to a record pushed its minimum claim confidence
*below* the 0.75 publish floor. More research made a record less publishable.

## The acceptance rule

A host is registered only when all three of these hold at once:

1. **Some Wikidata item names that host as its own official website (P856), at the site root.**
   `https://host/` or its `www.` form. Not a deep link: a link to an article about you is not a
   claim that you own the site.
2. **That item carries at least one authority-control identifier** — LCNAF (P244), VIAF (P214),
   ISNI (P213), ROR (P6782), GRID (P2427), or the IMLS Museum Universe Data File id (P6006).
   These are minted by national libraries and research-infrastructure registries for
   institutions they have actually cataloged.
3. **That item's instance-of (P31), followed up the subclass chain (P279\*), reaches one of the
   classes on the allowlist** in `packages/ops-data/scripts/lib/source-register.ts` — museum,
   archive, library, historical society, learned society, encyclopedia, university, research
   institute, hall of fame, government agency, public broadcaster, cultural institution,
   cemetery, newspaper.

Anything short of all three is a `review` for a person, never an automatic accept.

Wikipedia's own "official website" line may corroborate a reviewer's judgment. It is never
sufficient on its own: it is uncontrolled free text with no authority record behind it.

Two further rules narrow what the register may grant:

- **Government authority only through a government agency.** The register never assigns
  `government_record` to a host outside a government TLD unless the item is a government agency
  *and* carries an authority identifier.
- **`.gov` and `.mil` hosts are refused outright.** They are already `government_record` from
  their TLD, decided before the register is consulted, so an entry could only lower them: the
  Maryland State Archives is an `archive` in Wikidata's terms, and an archive is
  `reputable_secondary`.

## Why a fake site cannot pass it

A look-alike domain — `nypl.org.evil.example`, an invented `schomburg-center.co` — fails at (1).
No cataloged institution names it, and every host comparison in the register is against a parsed
hostname, so a look-alike cannot borrow a real host's name as a substring.

A vanity Wikidata item created for a museum that does not exist fails at (2). The attacker would
have to get a national library or ROR to catalog the invention first.

An item that exists but describes a *website*, a book, a prize or a town fails at (3). That last
one is not hypothetical: the first migration run found the Texas town of Anton, which has an LCNAF
record, is a city (which closes to "government agency"), and carries a P856 pointing at its
Handbook of Texas article. Without the site-root rule the tool would have proposed registering the
publisher's whole domain as a **government record** on a town's authority. It now rejects that.

## Using the tool

All three verbs live in `packages/ops-data/scripts/source-register.ts`. Run from the repo root.

**Propose.** Queries Wikidata and prints a proposal per host with a verdict of `accept`, `review`
or `reject`, plus every candidate item it looked at.

```bash
node --conditions development --import tsx packages/ops-data/scripts/source-register.ts \
  propose --hosts poets.org,nypl.org --out /tmp/proposals.json

# or walk the whole curated fallback list
node --conditions development --import tsx packages/ops-data/scripts/source-register.ts \
  propose --from-list --out /tmp/proposals.json
```

**Apply.** Writes the `accept` verdicts into the register, sorted and stable. Refuses everything
else and says why.

```bash
node --conditions development --import tsx packages/ops-data/scripts/source-register.ts \
  apply --file /tmp/proposals.json --reviewed-by "Your Name (context, date)"
```

Read the `review` reasons before you re-run anything. They are the interesting output: they say
whether a host failed because Wikidata is thin about it, or because it is not the kind of thing
the register should hold.

**Verify.** Re-checks each entry's basis against Wikidata and asks the host itself for a 2xx over
HTTPS. Exits non-zero on any drift, so a run before a publish pass fails loudly.

```bash
node --conditions development --import tsx packages/ops-data/scripts/source-register.ts \
  verify --older-than 180
```

Add `--record` to stamp `verifiedAt` on the entries that came back clean; without it the run is
read-only.

### How it finds the item

Two stages, because the obvious query does not work. A regular expression over every P856 value
in Wikidata is a full index scan and times out at the query service's 60-second ceiling (measured
2026-09-10). So the tool probes eight exact spellings of each homepage as a `VALUES` clause — an
index lookup that answers the whole curated list in under a second — and falls back to the wiki's
own search for candidate items on the misses. Search is a candidate generator only. The decision
is always made here, against the item's real P856 value.

Every call goes through the DNS-pinned safe-fetch path in
`packages/ops-data/scripts/lib/safe-fetch.ts`, never a bare `fetch()`, with a user agent that
names the tool per Wikimedia's policy and at least a second between query-service calls.

## Drift policy

Sites change hands. A university retires a department domain; a historical society merges; a
lapsed domain gets bought by someone selling something.

`verify` re-checks all three conditions plus liveness, prints what moved, and exits non-zero. It
**never deletes an entry**. A host that stops answering for an afternoon and a host that has been
sold look identical to a script and completely different to a person, and only the person can
tell them apart. Run it by hand before a publish pass or when a citation looks off, read the drift, and decide. Nothing schedules it: the operator chose an on-demand check over a job that gets muted.

## Why `unknown` stays at 0.2

It would be easy to raise the floor and make the whole problem go away. That would be the wrong
fix. `unknown` does not mean "probably fine" — it means the pipeline has no idea what it is
looking at, and the honest number for that is low. What was broken was not the score for
`unknown`; it was that real institutions were landing in `unknown` because nobody had typed them
into a list. The register moves the institutions out. Everything still in `unknown` genuinely is
unplaced, and should be scored as such.

## Known limits, and where they go next

- **Institutions with no authority identifier.** The largest group of `review` verdicts on the
  first migration run, and all of one kind: state encyclopedias. Encyclopedia of Alabama,
  Encyclopedia Virginia, NCpedia, MNopedia, Connecticut History and the Encyclopedia of Greater
  Philadelphia are real, edited publications that no national library has cataloged under their
  own name. They stay on the curated fallback list. The obvious extension is to accept the
  *publisher's* authority identifier (P123) as the basis, recorded as such — checked on the
  first run, it would buy exactly one host (64 Parishes, published by the Louisiana Endowment for
  the Humanities), which is not enough to justify loosening the rule yet.
- **Institutions Wikidata classes as something else.** The nine NPHC organizations are
  "collegiate fraternity" and "collegiate sorority"; SABR is an "organization". Widening the
  allowlist to admit them is a one-line change and an editorial judgment, not a technical one.
  It has not been made.
- **Small institutions with no Wikidata item at all.** Nothing to check, so nothing to register.
  The curated list is the right place for those, with a dated note saying who verified them.
- **A vandalized P856.** Wikidata is editable, and an edit that repoints an institution's website
  is not visible to a single-shot query. `verify` is the control: it re-reads the basis on a
  schedule and reports the change. That narrows the window rather than closing it, which is why
  every entry also carries the reviewer's name.
