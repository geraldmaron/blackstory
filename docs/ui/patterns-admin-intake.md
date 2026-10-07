# Admin intake

The staff intake surfaces follow the v10 surface law and the shared kit. Reuse the existing
operations queue cards, workbench filters, notice blocks, and decision form; no additional visual
language or styling is introduced.

The operations home links directly to Submissions and shows the live quarantined count. An
unavailable count must say unavailable. The Inbox remains a research-case queue. Submissions
includes public leads, corrections, abuse reports, and appealed corrections alongside research
proposals. Search and status/kind filters use the existing URL codec.

Every intake decision requires a reason and verified research permission. Quarantined items offer
promotion, rejection, or spam. Promotion opens a research case without publishing and reuses that
case if an appeal returns the submission to review. A promoted
correction offers closure as resolved or rejected after staff verify the outcome. Closing a
receipt does not itself edit or publish the target record. An eligible first appeal reopens the
same submission and preserves its evidence. Public receipts show only coarse status and a generic
decline explanation; internal notes remain staff-only.

Quick add and Attach evidence use the signed-in staff identity. An editable operator field must
not control audit attribution. Prepared previews are distinct from committed quarantine writes.

Use the shared theme-aware controls and focus rings. Verify both themes, staff and denied access,
empty and populated queues, receipt lookup, and errors. The lifecycle contract is documented in
[submission quarantine](../security/submission-quarantine.md).

Submission detail links share the notice link color and focus ring in both themes. A resolved
correction displays Resolved even though its research promotion remains recorded separately.
Client-side staff desks call the protected `/admin/api` handlers, including case transitions,
catalog selection, and story review.
