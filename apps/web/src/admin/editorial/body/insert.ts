/** What the `/` menu and the + Insert button can place, and how each is placed. */
import type { Editor, JSONContent } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import {
  faHeading,
  faImage,
  faListOl,
  faListUl,
  faMinus,
  faQuoteRight,
  faTable,
  faVideo,
  faMapLocationDot,
  faChartColumn,
  faHashtag,
  faFileLines,
  faTimeline,
  faScaleBalanced,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import type { StoryBodyBlockDoc } from '@repo/schemas';
import { storyToDocument } from '../document-adapter';

export type InsertEntry = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: IconDefinition;
  /** Extra words the filter matches. */
  readonly keywords: string;
  readonly separatorBefore?: boolean;
};

export const INSERT_ENTRIES: readonly InsertEntry[] = [
  {
    id: 'heading-2',
    label: 'Heading',
    description: 'A large heading that starts a section.',
    icon: faHeading,
    keywords: 'h2 title chapter',
  },
  {
    id: 'heading-3',
    label: 'Subheading',
    description: 'A smaller heading inside a section.',
    icon: faHeading,
    keywords: 'h3 title',
  },
  {
    id: 'bullets',
    label: 'Bulleted list',
    description: 'Short items, each cited on its own.',
    icon: faListUl,
    keywords: 'ul bullets',
  },
  {
    id: 'numbers',
    label: 'Numbered list',
    description: 'Items in a fixed order.',
    icon: faListOl,
    keywords: 'ol ordered steps',
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'A pulled quotation set apart from the text.',
    icon: faQuoteRight,
    keywords: 'pullquote blockquote',
  },
  {
    id: 'image',
    label: 'Image',
    description: 'A photograph or scan with its credit and rights.',
    icon: faImage,
    keywords: 'photo picture figure',
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Rows and columns of short text, with a caption.',
    icon: faTable,
    keywords: 'grid data',
  },
  {
    id: 'video',
    label: 'Video',
    description: 'A video from YouTube, Vimeo, the Internet Archive or the Library of Congress.',
    icon: faVideo,
    keywords: 'film youtube vimeo',
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'A rule that breaks the text between sections.',
    icon: faMinus,
    keywords: 'rule break hr line',
  },
  {
    id: 'mapInset',
    label: 'Record map',
    description: 'A small map of a record in the archive.',
    icon: faMapLocationDot,
    keywords: 'place location evidence',
    separatorBefore: true,
  },
  {
    id: 'figure',
    label: 'Figure',
    description: 'A chart drawn from a data packet.',
    icon: faChartColumn,
    keywords: 'chart graph evidence',
  },
  {
    id: 'stat',
    label: 'Statistic',
    description: 'One sourced number, shown large.',
    icon: faHashtag,
    keywords: 'number data evidence',
  },
  {
    id: 'primaryDocument',
    label: 'Primary document',
    description: 'An excerpt from a document in the archive.',
    icon: faFileLines,
    keywords: 'source excerpt evidence',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Dated events in order.',
    icon: faTimeline,
    keywords: 'dates events evidence',
  },
  {
    id: 'dispute',
    label: 'Disputed account',
    description: 'Two sources that disagree, side by side.',
    icon: faScaleBalanced,
    keywords: 'conflict sources evidence',
  },
];

export function filterInsertEntries(query: string): InsertEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return INSERT_ENTRIES.filter((entry) => {
    const haystack = `${entry.label} ${entry.keywords}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export type InsertContext = {
  /** Evidence blocks are placed by the frame, at this body index. */
  readonly onInsertBlock: (type: StoryBodyBlockDoc['type'], index: number | null) => void;
};

/** Start of the top-level block holding the selection, or the selected block itself. */
function topLevelStart(editor: Editor): number {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection && selection.$from.depth === 0) return selection.from;
  return selection.$from.before(1);
}

/** Place a block after the current one; an empty paragraph is replaced instead of left behind. */
function placeBlock(editor: Editor, node: JSONContent): number {
  const top = topLevelStart(editor);
  const current = editor.state.doc.nodeAt(top);
  const replace = current?.type.name === 'paragraph' && current.content.size === 0;
  const from = replace ? top : top + (current?.nodeSize ?? 0);
  editor
    .chain()
    .insertContentAt(replace ? { from: top, to: top + current!.nodeSize } : from, node)
    .run();
  return from;
}

const emptyTable = (): JSONContent => {
  const cells = ['', '', ''];
  return storyToDocument([
    { type: 'table', caption: '', header: true, rows: [cells, cells, cells] },
  ]).content![0]!;
};

export const newVideoBlock = (patch: Partial<StoryBodyBlockDoc> = {}): StoryBodyBlockDoc =>
  ({
    type: 'video',
    provider: 'youtube',
    videoId: '',
    title: '',
    credit: '',
    rightsStatus: 'licensed',
    ...patch,
  }) as StoryBodyBlockDoc;

export function runInsert(editor: Editor, id: string, context: InsertContext): void {
  const chain = () => editor.chain().focus();
  switch (id) {
    case 'heading-2':
    case 'heading-3':
      chain()
        .setHeading({ level: id === 'heading-2' ? 2 : 3 })
        .run();
      return;
    case 'bullets':
      chain().toggleBulletList().run();
      return;
    case 'numbers':
      chain().toggleOrderedList().run();
      return;
    case 'quote':
      chain().toggleBlockquote().run();
      return;
    case 'table': {
      const at = placeBlock(editor, emptyTable());
      // Cursor in the first header cell: storyTable > table > row > cell > paragraph.
      editor.view.dispatch(
        editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(at + 5))),
      );
      editor.view.focus();
      return;
    }
    case 'video': {
      const at = placeBlock(editor, { type: 'storyVideo', attrs: { storyBlock: newVideoBlock() } });
      editor.view.dispatch(
        editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, at)),
      );
      return;
    }
    case 'divider':
      placeBlock(editor, { type: 'horizontalRule' });
      editor.view.focus();
      return;
    default: {
      // After the current block; the caller clamps it to the saved body.
      context.onInsertBlock(
        id as StoryBodyBlockDoc['type'],
        editor.state.selection.$from.index(0) + 1,
      );
    }
  }
}
