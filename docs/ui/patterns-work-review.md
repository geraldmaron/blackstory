# Management request review

The private `/admin/work` inbox uses the admin shell and shared light/dark tokens. It is a reading and decision surface, with one column and no fixed-width evidence tables.

Show the request, execution status, interpretation and exceptions before individual records. A saved request is not a running job. Dispatch failure and failed public verification remain visible, with an idempotent retry action.

Each proposed record shows its operation, existing summary when present, proposed summary, jurisdiction, map precision, topics, periods, omissions and blockers. Evidence sits in native disclosures with citations, exact passages, limitations and the basis of review. A self-review must never be presented as a separate reviewer.

Selection binds a decision to the displayed version and hash. Approving means applying and publishing that selected content. Requesting changes needs a reason. Holding a record leaves the other approved records eligible. Blocked records can be selected for changes or hold, but cannot be approved. Published selections cannot be approved again. A changed proposal returns a conflict and requires the affected selection to be reviewed again.

Use labeled fields, visible keyboard focus, 44px minimum action targets, wrapping action rows and readable evidence on narrow screens. Status announcements must not repeatedly announce the whole record during polling. Stop polling hidden tabs. Failed loading must retain a readable error, not appear as an empty inbox. Completion shows verified record links and remaining held items, never a JSON dump.

Implemented in `apps/web/src/admin/work/`. The actual inbox was exercised at 390px in both themes and at 1280px against an isolated database. Evidence disclosure, hold, request submission, keyboard focus and failed dispatch were checked. Hosted continuation and native-device behavior remain unverified.

Inline links and checkbox accents use the theme-aware accent token. The shared admin footer
uses surface/ink/accent tokens together; never invert its background token while retaining
fixed pale text. This was observed to hide the footer label in dark mode during review QA.
