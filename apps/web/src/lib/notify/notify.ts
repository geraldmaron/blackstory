/**
 * Outbound email for public intake. What sends it:
 *   correction sent (with an email)   -> correction.received to the submitter
 *   appeal sent (with an email)       -> appeal.received to the submitter
 *   staff resolve / reject a receipt  -> correction.closed to the submitter (never on spam)
 *   correction, appeal, abuse report, lead -> owner.new_submission to the owner mailbox
 *
 * To add a notification: add a template to `TEMPLATES`, then call `notify()` where the event
 * happens. Every template renders through the same branded layout, as HTML and plain text. Sending goes through Resend's HTTP API with plain `fetch`, and is
 * off until `RESEND_API_KEY` and `NOTIFY_FROM_EMAIL` are set: without them every call is logged
 * and skipped, so intake never fails or slows down because mail is unconfigured or down.
 */
import { after } from 'next/server';
import { SUPPORT_CONTACT } from '../config/contact';
import { isEmail } from '../../components/forms/validators';

/** A submitter-typed contact, if it is an address mail can go to. Anything else is not mailed. */
export function recipientFrom(value: unknown): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed && isEmail(trimmed) ? trimmed : undefined;
}

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048';
}

function statusLink(receiptCode: string): string {
  return `${siteOrigin()}/corrections/status/${encodeURIComponent(receiptCode)}`;
}

/** Submitter-typed text, cut to a length that reads as an excerpt. */
function excerpt(value: string, max = 400): string {
  const flat = value.trim().replace(/\s+/gu, ' ');
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

/**
 * One email, before rendering. Voice follows docs/ui/story.md: Gerald speaks as "I", there is no
 * "we", corrections are routine and procedural, no exclamation marks, and pipeline words
 * (queue, quarantine, promoted) never reach a submitter.
 */
type Email = {
  readonly subject: string;
  /** The inbox preview line. */
  readonly preheader: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  /** A receipt code, set apart in mono so it can be copied. */
  readonly code?: string;
  /** What the submitter wrote, shown to the owner as a quote. */
  readonly quote?: string;
  readonly action?: { readonly label: string; readonly href: string };
  readonly signed: boolean;
  readonly footer: string;
};

const SUBMITTER_FOOTER =
  'You’re getting this because you left this address with a correction on BlackStory. It’s used only for that correction, and never shown publicly.';
const OWNER_FOOTER =
  'Sent to the BlackStory owner mailbox. Submitter contact details stay in the admin.';

type Template<Data> = (data: Data) => Email;

const TEMPLATES = {
  'correction.received': (d: { receiptCode: string }) => ({
    subject: `Correction received, ${d.receiptCode}`,
    preheader: 'Keep this email. Your receipt code is how you check the outcome.',
    heading: 'Your correction arrived',
    paragraphs: [
      'Thanks for sending it. I’ll read it against the published sources, usually within ten working days.',
      'I’ll write once more when it’s closed. If the record changes, the change goes in Errata with the earlier wording still readable. If it doesn’t, you can appeal once.',
      'This is your receipt code. Keep this email, since the code is how you check where things stand.',
    ],
    code: d.receiptCode,
    action: { label: 'Check the status', href: statusLink(d.receiptCode) },
    signed: true,
    footer: SUBMITTER_FOOTER,
  }),
  'correction.closed': (d: {
    receiptCode: string;
    outcome: 'resolved' | 'rejected';
    appealAvailable: boolean;
  }) =>
    d.outcome === 'resolved'
      ? {
          subject: `Correction closed, ${d.receiptCode}`,
          preheader: 'I’ve finished reviewing your correction.',
          heading: 'Your correction is closed',
          paragraphs: [
            'I’ve finished reviewing your correction against the published sources.',
            `Where the record changed, the change is listed in Errata at ${siteOrigin()}/errata, with the earlier wording still readable.`,
            'Thanks for taking the time to send it.',
          ],
          code: d.receiptCode,
          action: { label: 'See the outcome', href: statusLink(d.receiptCode) },
          signed: true,
          footer: SUBMITTER_FOOTER,
        }
      : {
          subject: `Correction declined, ${d.receiptCode}`,
          preheader: 'The record stays as it is.',
          heading: 'The record stays as it is',
          paragraphs: [
            'I reviewed your correction against the published sources and didn’t change the record.',
            d.appealAvailable
              ? 'If you think the review missed something, you can appeal once from the status page. Say what was missed and link the source that shows it.'
              : 'This was the review of your appeal, so it’s the final outcome for this correction.',
          ],
          code: d.receiptCode,
          action: {
            label: d.appealAvailable ? 'Appeal or see the outcome' : 'See the outcome',
            href: statusLink(d.receiptCode),
          },
          signed: true,
          footer: SUBMITTER_FOOTER,
        },
  'appeal.received': (d: { receiptCode: string }) => ({
    subject: `Appeal received, ${d.receiptCode}`,
    preheader: 'Your correction is back in review.',
    heading: 'Your appeal arrived',
    paragraphs: [
      'I’ll review the correction again with what you sent.',
      'Each correction gets one appeal, so this next review is the final one. I’ll email you when it’s closed.',
    ],
    code: d.receiptCode,
    action: { label: 'Check the status', href: statusLink(d.receiptCode) },
    signed: true,
    footer: SUBMITTER_FOOTER,
  }),
  /** To the owner: enough to triage from the inbox, with contact details left in the admin. */
  'owner.new_submission': (d: {
    kind: 'correction' | 'appeal' | 'abuse report' | 'lead' | 'test';
    headline: string;
    statement?: string;
    id: string;
  }) => ({
    subject: `New ${d.kind} · ${d.headline}`.slice(0, 140),
    preheader: d.statement ? excerpt(d.statement, 120) : d.headline,
    heading: `New ${d.kind}`,
    paragraphs: [d.headline],
    ...(d.statement ? { quote: excerpt(d.statement) } : {}),
    action: { label: 'Open it in the admin', href: `${siteOrigin()}/admin/submissions/${d.id}` },
    signed: false,
    footer: OWNER_FOOTER,
  }),
} satisfies Record<string, Template<never>>;

export type NotificationEvent = keyof typeof TEMPLATES;
export type NotificationData<E extends NotificationEvent> = Parameters<(typeof TEMPLATES)[E]>[0];

export type Notification = {
  [E in NotificationEvent]: {
    readonly event: E;
    /** Recipient address. `'owner'` sends to the published support mailbox. */
    readonly to: string | 'owner';
    readonly data: NotificationData<E>;
    /** Same key, same email: Resend drops the repeat for 24 hours. */
    readonly idempotencyKey: string;
  };
}[NotificationEvent];

export type SendResult =
  | { readonly status: 'sent'; readonly id: string }
  | { readonly status: 'skipped'; readonly reason: 'not_configured' | 'no_recipient' }
  | { readonly status: 'failed'; readonly detail: string };

const SIGNATURE = ['Gerald Dagher', 'BlackStory'];

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function renderText(e: Email): string {
  const parts = [e.heading, '', ...e.paragraphs.flatMap((p) => [p, ''])];
  if (e.code) parts.push(`Receipt code  ${e.code}`, '');
  if (e.quote) parts.push(...e.quote.split('\n').map((line) => `> ${line}`), '');
  if (e.action) parts.push(e.action.label, e.action.href, '');
  if (e.signed) parts.push(...SIGNATURE, '');
  parts.push('---', e.footer);
  return parts.join('\n');
}

// Brand tokens from docs/ui/brand.md. Email clients ignore web fonts, so each stack ends in a
// system face; the copper button carries ink text (4.9:1), never white.
const C = {
  paper: '#F4EFE5',
  surface: '#FBF8F2',
  ink: '#0A0A0A',
  stone: '#6D675F',
  rule: '#D7D0C4',
  copper: '#B86B2A',
  copperText: '#8E4F2A',
};
const SANS = "Geist, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const HEAD = "'Schibsted Grotesk', Geist, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'Geist Mono', ui-monospace, Menlo, Consolas, monospace";

function renderHtml(e: Email): string {
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font:400 16px/1.55 ${SANS};color:${C.ink};">${escapeHtml(text)}</p>`;
  const code = e.code
    ? `<p style="margin:4px 0 20px;"><span style="display:inline-block;padding:10px 14px;border:1px solid ${C.rule};border-radius:6px;background:${C.paper};font:600 17px/1 ${MONO};letter-spacing:0.02em;color:${C.ink};">${escapeHtml(e.code)}</span></p>`
    : '';
  const quote = e.quote
    ? `<blockquote style="margin:0 0 20px;padding:4px 0 4px 14px;border-left:3px solid ${C.copper};font:400 15px/1.55 ${SANS};color:${C.stone};">${escapeHtml(e.quote)}</blockquote>`
    : '';
  const action = e.action
    ? `<p style="margin:8px 0 24px;"><a href="${escapeHtml(e.action.href)}" style="display:inline-block;padding:12px 20px;border-radius:6px;background:${C.copper};font:600 15px/1 ${SANS};color:${C.ink};text-decoration:none;">${escapeHtml(e.action.label)}</a></p>`
    : '';
  const signature = e.signed
    ? `<p style="margin:8px 0 0;font:400 15px/1.5 ${SANS};color:${C.ink};">${SIGNATURE.map(escapeHtml).join('<br>')}</p>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(e.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(e.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px;"><a href="${escapeHtml(siteOrigin())}"><img src="${escapeHtml(siteOrigin())}/brand/email-lockup.png" width="160" height="49" alt="BlackStory" style="display:block;border:0;"></a></td></tr>
<tr><td style="padding:32px;background:${C.surface};border:1px solid ${C.rule};border-top:3px solid ${C.copper};border-radius:8px;">
<h1 style="margin:0 0 16px;font:700 24px/1.25 ${HEAD};letter-spacing:-0.01em;color:${C.ink};">${escapeHtml(e.heading)}</h1>
${e.paragraphs.map(p).join('\n')}
${code}${quote}${action}${signature}
</td></tr>
<tr><td style="padding:20px 4px 0;font:400 13px/1.5 ${SANS};color:${C.stone};">${escapeHtml(e.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderNotification(n: Notification): {
  subject: string;
  text: string;
  html: string;
} {
  const email = (TEMPLATES[n.event] as Template<typeof n.data>)(n.data);
  return { subject: email.subject, text: renderText(email), html: renderHtml(email) };
}

/** Sends one notification now. Never throws: mail is a courtesy, never a reason intake fails. */
export async function sendNotification(
  n: Notification,
  env: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const to = n.to === 'owner' ? env.NOTIFY_OWNER_EMAIL?.trim() || SUPPORT_CONTACT : n.to.trim();
  if (!to) return { status: 'skipped', reason: 'no_recipient' };
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.NOTIFY_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    console.info('notify: skipped, mail not configured', { event: n.event });
    return { status: 'skipped', reason: 'not_configured' };
  }
  const { subject, text, html } = renderNotification(n);
  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': n.idempotencyKey,
      },
      body: JSON.stringify({ from, to: [to], reply_to: SUPPORT_CONTACT, subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const detail = `${response.status} ${(await response.text()).slice(0, 300)}`;
      console.error('notify: send failed', { event: n.event, detail });
      return { status: 'failed', detail };
    }
    const body = (await response.json()) as { id?: string };
    return { status: 'sent', id: body.id ?? '' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('notify: send failed', { event: n.event, detail });
    return { status: 'failed', detail };
  }
}

/**
 * Sends after the response has gone out, so a slow mail API never delays the submitter. Outside
 * a request (scripts, tests) `after` throws, and the send just runs in the background instead.
 */
export function notify(n: Notification): void {
  const task = () => sendNotification(n).then(() => undefined);
  try {
    after(task);
  } catch {
    void task();
  }
}

export type Notifier = (n: Notification) => void;
