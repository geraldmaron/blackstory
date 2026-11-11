/**
 * The one inline grammar for story prose (paragraphs, list items, pull quotes, table cells,
 * captions). Zod-free and free of node imports so the public renderer, the editor and the
 * publish gates all parse the same way.
 *
 * Precedence: atoms (`[ref:id]`, `[[entityId|Label]]`, newline) are opaque and never re-scanned;
 * then `[label](https://url)`; then `**strong**` and `_em_` over text; `\\`, `\*`, `\_` escape.
 * Anything that does not match stays literal text.
 */

export type StoryInlineNode =
  | { type: 'text'; text: string }
  | { type: 'break' }
  | { type: 'cite'; refId: string }
  | { type: 'entity'; entityId: string; label: string }
  | { type: 'link'; href: string; children: StoryInlineNode[] }
  | { type: 'strong'; children: StoryInlineNode[] }
  | { type: 'em'; children: StoryInlineNode[] };

type Mark = 'strong' | 'em';

// Same entity pattern as ENTITY_PROSE_LINK_RE in @repo/domain (sticky, non-global here).
const CITE_RE = /\[ref:([a-z0-9]+(?:-[a-z0-9]+)*)\]/y;
const ENTITY_RE = /\[\[([^|\][]+)(?:\|([^\][]+))?\]\]/y;
const LINK_RE = /\[((?:\\[\\[\]*_]|[^\][\n\\]|\\(?![\\[\]*_]))+)\]\((https:\/\/[^\s)]+)\)/y;
const LINK_LIKE_RE = /\[([^\][\n]+)\]\(([^\s)]+)\)/g;

/** https only, parses as a URL, no embedded credentials, no whitespace. */
export function isSafeStoryLinkHref(href: string): boolean {
  if (!href.startsWith('https://') || /\s/.test(href)) return false;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** Hrefs written as `[label](href)` that are not safe external links (for publish gates). */
export function findUnsafeStoryLinkHrefs(text: string): string[] {
  const bad: string[] = [];
  for (const match of text.matchAll(LINK_LIKE_RE)) {
    if (match[1]!.startsWith('ref:')) continue;
    if (!isSafeStoryLinkHref(match[2]!)) bad.push(match[2]!);
  }
  return bad;
}

type Token =
  | { k: 'node'; node: StoryInlineNode }
  | { k: 'text'; s: string }
  | { k: 'delim'; mark: Mark; raw: string; canOpen: boolean; canClose: boolean };

const WS = /\s/;
const ALNUM_END = /[\p{L}\p{N}]$/u;
const ALNUM_START = /^[\p{L}\p{N}]/u;

function lex(s: string): Token[] {
  const tokens: Token[] = [];
  let buf = '';
  const flush = () => {
    if (buf) tokens.push({ k: 'text', s: buf });
    buf = '';
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '\\') {
      const n = s[i + 1];
      if (n === '\\' || n === '*' || n === '_' || n === '[' || n === ']') {
        buf += n;
        i += 2;
      } else {
        buf += c;
        i += 1;
      }
      continue;
    }
    if (c === '\n') {
      flush();
      tokens.push({ k: 'node', node: { type: 'break' } });
      i += 1;
      continue;
    }
    if (c === '[') {
      CITE_RE.lastIndex = i;
      let m = CITE_RE.exec(s);
      if (m) {
        flush();
        tokens.push({ k: 'node', node: { type: 'cite', refId: m[1]! } });
        i += m[0].length;
        continue;
      }
      ENTITY_RE.lastIndex = i;
      m = ENTITY_RE.exec(s);
      if (m) {
        flush();
        tokens.push({
          k: 'node',
          node: { type: 'entity', entityId: m[1]!, label: m[2] ?? '' },
        });
        i += m[0].length;
        continue;
      }
      LINK_RE.lastIndex = i;
      m = LINK_RE.exec(s);
      if (m && m[1]!.trim() !== '' && isSafeStoryLinkHref(m[2]!)) {
        flush();
        tokens.push({
          k: 'node',
          node: { type: 'link', href: m[2]!, children: parseStoryInline(m[1]!) },
        });
        i += m[0].length;
        continue;
      }
      buf += c;
      i += 1;
      continue;
    }
    if (c === '*' || c === '_') {
      let j = i;
      while (s[j] === c) j += 1;
      const run = j - i;
      // `**` is strong, a lone `_` is em; any other run length is literal.
      if ((c === '*' && run === 2) || (c === '_' && run === 1)) {
        const before = s.slice(Math.max(0, i - 2), i);
        const after = s.slice(j, j + 2);
        let canOpen = after !== '' && !WS.test(after[0]!);
        let canClose = before !== '' && !WS.test(before.slice(-1));
        if (c === '_') {
          if (ALNUM_END.test(before)) canOpen = false;
          if (ALNUM_START.test(after)) canClose = false;
        }
        flush();
        tokens.push({
          k: 'delim',
          mark: c === '*' ? 'strong' : 'em',
          raw: s.slice(i, j),
          canOpen,
          canClose,
        });
      } else {
        buf += s.slice(i, j);
      }
      i = j;
      continue;
    }
    buf += c;
    i += 1;
  }
  flush();
  return tokens;
}

function pushNode(into: StoryInlineNode[], node: StoryInlineNode): void {
  const last = into[into.length - 1];
  if (node.type === 'text' && last?.type === 'text') last.text += node.text;
  else into.push(node);
}

/** Build a mark node in canonical shape: same-mark children unwrapped, strong outside em. */
function makeMark(mark: Mark, children: StoryInlineNode[]): StoryInlineNode {
  const flat: StoryInlineNode[] = [];
  for (const child of children) {
    if (child.type === mark) child.children.forEach((c) => pushNode(flat, c));
    else pushNode(flat, child);
  }
  if (mark === 'em' && flat.length === 1 && flat[0]!.type === 'strong') {
    return { type: 'strong', children: [{ type: 'em', children: flat[0]!.children }] };
  }
  return { type: mark, children: flat };
}

export function parseStoryInline(text: string): StoryInlineNode[] {
  type Frame = { mark: Mark | null; raw: string; children: StoryInlineNode[] };
  const stack: Frame[] = [{ mark: null, raw: '', children: [] }];
  const top = () => stack[stack.length - 1]!;
  // An unclosed or empty opener is literal: its delimiter text then its content.
  const demote = (frame: Frame) => {
    const parent = top();
    pushNode(parent.children, { type: 'text', text: frame.raw });
    frame.children.forEach((c) => pushNode(parent.children, c));
  };
  for (const token of lex(text)) {
    if (token.k === 'text') {
      pushNode(top().children, { type: 'text', text: token.s });
    } else if (token.k === 'node') {
      pushNode(top().children, token.node);
    } else {
      let handled = false;
      if (token.canClose) {
        let at = -1;
        for (let k = stack.length - 1; k > 0; k -= 1) {
          if (stack[k]!.mark === token.mark) {
            at = k;
            break;
          }
        }
        if (at > 0) {
          while (stack.length - 1 > at) demote(stack.pop()!);
          const frame = stack.pop()!;
          if (frame.children.length === 0) {
            demote(frame);
            pushNode(top().children, { type: 'text', text: token.raw });
          } else {
            pushNode(top().children, makeMark(token.mark, frame.children));
          }
          handled = true;
        }
      }
      if (!handled) {
        if (token.canOpen) stack.push({ mark: token.mark, raw: token.raw, children: [] });
        else pushNode(top().children, { type: 'text', text: token.raw });
      }
    }
  }
  while (stack.length > 1) demote(stack.pop()!);
  return stack[0]!.children;
}

/** Merge adjacent text and same-mark nodes so the output is canonical. */
function normalize(nodes: readonly StoryInlineNode[]): StoryInlineNode[] {
  const out: StoryInlineNode[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (node.type === 'text') {
      if (node.text === '') continue;
      if (last?.type === 'text') last.text += node.text;
      else out.push({ ...node });
    } else if (node.type === 'strong' || node.type === 'em') {
      if (last?.type === node.type) last.children = normalize([...last.children, ...node.children]);
      else out.push({ type: node.type, children: normalize(node.children) });
    } else if (node.type === 'link') {
      out.push({ ...node, children: normalize(node.children) });
    } else {
      out.push(node);
    }
  }
  return out;
}

type Mode = 'plain' | 'escaped';

/**
 * `escaped` escapes every character the grammar could read as markup; `plain` escapes nothing
 * outside link labels (whose brackets must always be escaped).
 */
function escapeText(text: string, mode: Mode, inLink: boolean): string {
  if (mode === 'escaped') return text.replace(/[\\*_[\]]/g, '\\$&');
  return inLink ? text.replace(/[\\[\]]/g, '\\$&') : text;
}

function render(nodes: readonly StoryInlineNode[], mode: Mode, inLink = false): string {
  let out = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        out += escapeText(node.text, mode, inLink);
        break;
      case 'break':
        out += '\n';
        break;
      case 'cite':
        out += `[ref:${node.refId}]`;
        break;
      case 'entity':
        out += node.label === '' ? `[[${node.entityId}]]` : `[[${node.entityId}|${node.label}]]`;
        break;
      case 'link':
        out += `[${render(node.children, mode, true)}](${node.href.replace(/\s/g, encodeURIComponent).replace(/\)/g, '%29')})`;
        break;
      case 'strong':
        out += `**${render(node.children, mode, inLink)}**`;
        break;
      case 'em':
        out += `_${render(node.children, mode, inLink)}_`;
        break;
    }
  }
  return out;
}

/**
 * Canonical text for a node tree. The unescaped form is kept whenever it reads back as the same
 * tree, so prose written before this grammar (and ordinary punctuation such as `5 * 3`,
 * `snake_case` or `[sic]`) is stored exactly as typed; escapes appear only where a character
 * would otherwise be read as markup.
 */
export function serializeStoryInline(nodes: readonly StoryInlineNode[]): string {
  const tree = normalize(nodes);
  const escaped = render(tree, 'escaped');
  const plainText = render(tree, 'plain');
  if (plainText === escaped) return plainText;
  return render(normalize(parseStoryInline(plainText)), 'escaped') === escaped
    ? plainText
    : escaped;
}

function plain(nodes: readonly StoryInlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.text;
        case 'break':
          return '\n';
        case 'cite':
          return ' ';
        case 'entity':
          return node.label.trim() || node.entityId.trim();
        default:
          return plain(node.children);
      }
    })
    .join('');
}

/** Visible words: labels kept, citations become a space (as the old gates did), marks removed. */
export function storyInlinePlainText(text: string): string {
  return plain(parseStoryInline(text));
}
