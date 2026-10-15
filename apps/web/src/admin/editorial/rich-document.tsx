'use client';
import { useEffect, useRef } from 'react';
import {
  EditorContent,
  useEditor,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';
import { Node, Extension, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import ListItem from '@tiptap/extension-list-item';
import { Button } from 'baseui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faListUl,
  faListOl,
  faQuoteRight,
  faSliders,
  faRotateLeft,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons';
import { Select } from 'baseui/select';
import type { ArticleBodyBlockDoc, ArticleReferenceDoc } from '@repo/schemas';
import { articleToDocument, documentToArticle } from './document-adapter';
const Citation = Node.create({
  name: 'citation',
  inline: true,
  group: 'inline',
  atom: true,
  addAttributes: () => ({ refId: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-article-citation]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, {
      'data-article-citation': node.attrs.refId,
      class: 'editorial-citation-token',
    }),
    `[${node.attrs.refId}]`,
  ],
});
const PreserveBlock = Extension.create({
  name: 'preserveArticleBlock',
  addGlobalAttributes: () => [
    {
      types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList'],
      attributes: { articleBlock: { default: null, renderHTML: () => ({}) } },
    },
  ],
});
function EvidenceCard({ node, selected, extension, getPos, editor }: NodeViewProps) {
  const block = node.attrs.articleBlock as ArticleBodyBlockDoc;
  const label =
    block.type === 'image'
      ? block.image.alt || 'Image description needed'
      : 'caption' in block
        ? block.caption
        : 'label' in block
          ? block.label
          : 'packetId' in block
            ? block.packetId
            : '';
  return (
    <NodeViewWrapper
      className={`editorial-evidence-card${selected ? ' editorial-evidence-card--selected' : ''}`}
      contentEditable={false}
    >
      <div>
        <span className="editorial-evidence-card__type">{block.type}</span>
        <p>{label || 'Complete this evidence block'}</p>
      </div>
      <Button
        kind="secondary"
        size="compact"
        onClick={() => {
          const pos = getPos();
          if (typeof pos === 'number') {
            editor.commands.setNodeSelection(pos);
            extension.options.onEdit(editor.state.doc.resolve(pos).index(0));
          }
        }}
      >
        Edit block
      </Button>
    </NodeViewWrapper>
  );
}
const EvidenceBlock = Node.create({
  name: 'editorialBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addOptions: () => ({ onEdit: (_index: number) => {} }),
  addAttributes: () => ({ articleBlock: { default: null, renderHTML: () => ({}) } }),
  parseHTML: () => [],
  renderHTML: () => ['div', { 'data-editorial-block': '' }],
  addNodeView: () => ReactNodeViewRenderer(EvidenceCard),
});
const FlatListItem = ListItem.extend({ content: 'paragraph' });
export function RichDocument({
  body,
  onChange,
  editable,
  references,
  onEditBlock,
  onError,
}: {
  body: ArticleBodyBlockDoc[];
  onChange: (body: ArticleBodyBlockDoc[]) => void;
  editable: boolean;
  references: ArticleReferenceDoc[];
  onEditBlock: (index: number) => void;
  onError: (message: string) => void;
}) {
  const callbacks = useRef({ onChange, onEditBlock, onError });
  callbacks.current = { onChange, onEditBlock, onError };
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable,
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        underline: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
        listItem: false,
        heading: { levels: [2, 3] },
      }),
      FlatListItem,
      Citation,
      PreserveBlock,
      EvidenceBlock.configure({ onEdit: (index: number) => callbacks.current.onEditBlock(index) }),
    ],
    content: articleToDocument(body),
    editorProps: {
      attributes: {
        class: 'editorial-document__prose',
        role: 'textbox',
        'aria-label': 'Article body',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor }) => {
      try {
        callbacks.current.onChange(documentToArticle(editor.getJSON()));
      } catch (error) {
        callbacks.current.onError(
          error instanceof Error ? error.message : 'The article could not be saved.',
        );
      }
    },
  });
  useEffect(() => {
    if (!editor) return;
    try {
      if (JSON.stringify(documentToArticle(editor.getJSON())) !== JSON.stringify(body)) {
        const position = editor.state.selection.from;
        editor.commands.setContent(articleToDocument(body), { emitUpdate: false });
        editor.commands.setTextSelection(Math.min(position, editor.state.doc.content.size));
      }
    } catch (error) {
      callbacks.current.onError(
        error instanceof Error ? error.message : 'The article could not be restored.',
      );
    }
  }, [body, editor]);
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);
  const style = editor?.isActive('heading', { level: 2 })
    ? 'heading-2'
    : editor?.isActive('heading', { level: 3 })
      ? 'heading-3'
      : 'paragraph';
  return (
    <div className="editorial-document">
      <div className="editorial-document__toolbar" role="toolbar" aria-label="Article formatting">
        <div className="editorial-document__format">
          <Select
            size="compact"
            aria-label="Text style"
            searchable={true}
            clearable={false}
            disabled={!editable || !editor}
            options={[
              { id: 'paragraph', label: 'Paragraph' },
              { id: 'heading-2', label: 'Section heading' },
              { id: 'heading-3', label: 'Subheading' },
            ]}
            value={[{ id: style }]}
            onChange={({ value }) => {
              const choice = value[0]?.id;
              if (choice === 'paragraph') editor?.chain().focus().setParagraph().run();
              else
                editor
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: choice === 'heading-2' ? 2 : 3 })
                  .run();
            }}
          />
        </div>
        <Button
          aria-label="Bullets"
          title="Bullets"
          kind="tertiary"
          size="compact"
          disabled={!editable || !editor}
          isSelected={!!editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <FontAwesomeIcon icon={faListUl} aria-hidden="true" />
        </Button>
        <Button
          aria-label="Numbered list"
          title="Numbered list"
          kind="tertiary"
          size="compact"
          disabled={!editable || !editor}
          isSelected={!!editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <FontAwesomeIcon icon={faListOl} aria-hidden="true" />
        </Button>
        <Button
          aria-label="Quote"
          title="Quote"
          kind="tertiary"
          size="compact"
          disabled={!editable || !editor}
          isSelected={!!editor?.isActive('blockquote')}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <FontAwesomeIcon icon={faQuoteRight} aria-hidden="true" />
        </Button>
        <Button
          aria-label="Block details"
          title="Block details"
          kind="tertiary"
          size="compact"
          disabled={!editable || !editor}
          onClick={() => {
            if (!editor) return;
            const position = editor.state.selection.$from;
            onEditBlock(position.index(0));
          }}
        >
          <FontAwesomeIcon icon={faSliders} aria-hidden="true" />
        </Button>
        <Button
          aria-label="Undo"
          title="Undo"
          kind="tertiary"
          size="compact"
          disabled={!editable || !editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <FontAwesomeIcon icon={faRotateLeft} aria-hidden="true" />
        </Button>
        <Button
          aria-label="Redo"
          title="Redo"
          kind="tertiary"
          size="compact"
          disabled={!editable || !editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <FontAwesomeIcon icon={faRotateRight} aria-hidden="true" />
        </Button>
        <div className="editorial-document__citation">
          <Select
            size="compact"
            aria-label="Insert citation"
            placeholder="Insert citation"
            value={[]}
            clearable={false}
            disabled={!editable || !editor || !references.length}
            options={references.map((ref) => ({ id: ref.id, label: ref.label || ref.id }))}
            onChange={({ value }) => {
              const refId = value[0]?.id;
              if (refId)
                editor?.chain().focus().insertContent({ type: 'citation', attrs: { refId } }).run();
            }}
          />
        </div>
      </div>
      {!editor && <p role="status">Loading article editor…</p>}
      <EditorContent editor={editor} />
      <p className="editorial-document__help">
        Write in paragraphs, headings, lists and quotations. Insert source citations from the
        toolbar. Evidence blocks retain their reviewed bindings.
      </p>
    </div>
  );
}
