'use client';
/** React node views for the blocks the manuscript editor draws itself. */
import { useId, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown,
  faArrowUp,
  faPen,
  faTrashCan,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import type { StoryBodyBlockDoc, StoryVideoBlockDoc } from '@repo/schemas';
import { parseStoryVideoUrl, storyVideoWatchUrl } from '@repo/schemas/public-stories';
import { storyInlinePlainText } from '@repo/schemas/story-inline';
import { moveTopLevelBlock, removeTopLevelBlock } from '../editor-blocks';
import type { CitationInfo } from './lint-plugin';

const BLOCK_LABELS: Readonly<Record<string, string>> = {
  image: 'Image',
  mapInset: 'Record map',
  figure: 'Figure',
  stat: 'Statistic',
  primaryDocument: 'Primary document',
  timeline: 'Timeline',
  dispute: 'Disputed account',
};
export const blockLabel = (type: string) => BLOCK_LABELS[type] ?? 'Block';

const VIDEO_PROVIDER_LABEL = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  archive: 'Internet Archive',
  loc: 'Library of Congress',
} as const;
// The same wording the public reader uses.
const VIDEO_RIGHTS_LABEL = {
  public_domain: 'In the public domain',
  licensed: 'Used under license',
  fair_use: 'Used under fair use',
} as const;

/** A numbered superscript, in the order sources are first cited. */
export function CitationView({ node, selected, decorations }: NodeViewProps) {
  const info = decorations
    .map((decoration) => (decoration.spec as { citation?: CitationInfo }).citation)
    .find(Boolean);
  const refId = String(node.attrs.refId);
  if (info?.missing || !info) {
    return (
      <NodeViewWrapper
        as="span"
        className={`rd-cite rd-cite--missing${selected ? ' rd-cite--selected' : ''}`}
        title={`No source named “${refId}” is attached to this story.`}
      >
        <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
        <span> source missing</span>
      </NodeViewWrapper>
    );
  }
  return (
    <NodeViewWrapper
      as="sup"
      className={`rd-cite${selected ? ' rd-cite--selected' : ''}`}
      title={info.label}
      aria-label={`Reference ${info.number}: ${info.label}`}
    >
      {info.number}
    </NodeViewWrapper>
  );
}

function useTopLevelIndex({ getPos, editor }: Pick<NodeViewProps, 'getPos' | 'editor'>) {
  return () => {
    const pos = getPos();
    return typeof pos === 'number' ? editor.state.doc.resolve(pos).index(0) : null;
  };
}

/** Move up, move down and remove; revealed on hover and keyboard focus. */
function CardActions({
  props,
  children,
}: {
  props: Pick<NodeViewProps, 'getPos' | 'editor'>;
  children?: React.ReactNode;
}) {
  const index = useTopLevelIndex(props);
  const { editor } = props;
  const editable = editor.isEditable;
  return (
    <div className="rd-card__actions">
      {children}
      <button
        type="button"
        className="rd-btn"
        aria-label="Move block up"
        title="Move block up (Alt+Up)"
        disabled={!editable}
        onClick={() => {
          const at = index();
          if (at !== null) moveTopLevelBlock(editor, at, -1);
        }}
      >
        <FontAwesomeIcon icon={faArrowUp} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="rd-btn"
        aria-label="Move block down"
        title="Move block down (Alt+Down)"
        disabled={!editable}
        onClick={() => {
          const at = index();
          if (at !== null) moveTopLevelBlock(editor, at, 1);
        }}
      >
        <FontAwesomeIcon icon={faArrowDown} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="rd-btn"
        aria-label="Remove block"
        title="Remove block (undo restores it)"
        disabled={!editable}
        onClick={() => {
          const at = index();
          if (at !== null) removeTopLevelBlock(editor, at);
        }}
      >
        <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
      </button>
    </div>
  );
}

/** An evidence block placed in the text: figure, statistic, document, timeline, map, dispute, image. */
export function EvidenceCard(props: NodeViewProps) {
  const { node, selected, extension, getPos, editor } = props;
  const block = node.attrs.storyBlock as StoryBodyBlockDoc;
  const summary =
    block.type === 'image'
      ? block.caption
        ? storyInlinePlainText(block.caption)
        : ''
      : 'caption' in block && typeof block.caption === 'string'
        ? storyInlinePlainText(block.caption)
        : 'label' in block && typeof block.label === 'string'
          ? block.label
          : 'packetId' in block
            ? block.packetId
            : '';
  return (
    <NodeViewWrapper
      className={`rd-card${selected ? ' rd-card--selected' : ''}`}
      contentEditable={false}
    >
      <p className="rd-card__type">{blockLabel(block.type)}</p>
      {block.type === 'image' ? (
        <figure className="rd-card__image">
          {block.image.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- an admin preview of an arbitrary archive URL
            <img src={block.image.url} alt={block.image.alt} loading="lazy" />
          ) : null}
          <figcaption>
            {block.image.alt ? null : <strong>Image description needed. </strong>}
            {summary || (block.image.alt ? '' : 'Add a description and a caption.')}
          </figcaption>
        </figure>
      ) : (
        <p className="rd-card__summary">{summary || 'Complete this evidence block.'}</p>
      )}
      <CardActions props={props}>
        <button
          type="button"
          className="rd-btn rd-btn--text"
          onClick={() => {
            const pos = getPos();
            if (typeof pos === 'number') {
              editor.commands.setNodeSelection(pos);
              extension.options.onEdit(editor.state.doc.resolve(pos).index(0));
            }
          }}
        >
          <FontAwesomeIcon icon={faPen} aria-hidden="true" /> Edit block
        </button>
      </CardActions>
    </NodeViewWrapper>
  );
}

const VIDEO_URL_PROBLEM =
  'That link is not one I can play. Use a watch link from YouTube, Vimeo, the Internet Archive or the Library of Congress.';

/** A video: the public poster in typography, with its fields editable in place. Never loads the player. */
export function StoryVideoView(props: NodeViewProps) {
  const { node, selected, updateAttributes } = props;
  const block = node.attrs.storyBlock as StoryVideoBlockDoc;
  const problemId = useId();
  // A card that still needs its link, title or credit opens ready to fill in.
  const [editing, setEditing] = useState(block.videoId === '' || (!block.title && !block.credit));
  const [url, setUrl] = useState(block.videoId ? storyVideoWatchUrl(block) : '');
  const problem = url.trim() !== '' && !parseStoryVideoUrl(url) ? VIDEO_URL_PROBLEM : '';
  const update = (patch: Partial<StoryVideoBlockDoc>) => {
    const next = { ...block, ...patch };
    if (next.caption === '') delete next.caption;
    updateAttributes({ storyBlock: next });
  };
  return (
    <NodeViewWrapper
      className={`rd-card rd-video${selected ? ' rd-card--selected' : ''}`}
      contentEditable={false}
    >
      <p className="rd-card__type">Video</p>
      {editing ? (
        <div className="rd-video__form">
          <label className="rd-label">
            Video link
            <input
              className="rd-field"
              type="url"
              inputMode="url"
              value={url}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? problemId : undefined}
              placeholder="https://www.youtube.com/watch?v=…"
              onChange={(event) => {
                const next = event.target.value;
                setUrl(next);
                const parsed = parseStoryVideoUrl(next);
                if (parsed) update(parsed);
              }}
            />
          </label>
          {problem ? (
            <p className="rd-problem" role="alert" id={problemId}>
              {problem}
            </p>
          ) : null}
          <label className="rd-label">
            Title
            <input
              className="rd-field"
              type="text"
              value={block.title}
              onChange={(event) => update({ title: event.target.value })}
            />
          </label>
          <label className="rd-label">
            Credit
            <input
              className="rd-field"
              type="text"
              value={block.credit}
              onChange={(event) => update({ credit: event.target.value })}
            />
          </label>
          <label className="rd-label">
            Rights
            <select
              className="rd-field"
              value={block.rightsStatus}
              onChange={(event) =>
                update({ rightsStatus: event.target.value as StoryVideoBlockDoc['rightsStatus'] })
              }
            >
              <option value="public_domain">Public domain</option>
              <option value="licensed">Licensed</option>
              <option value="fair_use">Fair use</option>
            </select>
          </label>
          <label className="rd-label">
            Caption
            <input
              className="rd-field"
              type="text"
              value={block.caption ?? ''}
              onChange={(event) => update({ caption: event.target.value })}
            />
          </label>
          <p className="rd-hint">The player loads only when a reader presses play.</p>
        </div>
      ) : (
        <div className="rd-video__plate">
          <p className="rd-video__title">{block.title || 'Untitled video'}</p>
          <p className="rd-video__meta">
            {VIDEO_PROVIDER_LABEL[block.provider]}. {block.credit || 'Credit needed'}.{' '}
            {VIDEO_RIGHTS_LABEL[block.rightsStatus]}.
          </p>
          {block.caption ? (
            <p className="rd-card__caption">{storyInlinePlainText(block.caption)}</p>
          ) : null}
        </div>
      )}
      <CardActions props={props}>
        <button
          type="button"
          className="rd-btn rd-btn--text"
          disabled={editing && !parseStoryVideoUrl(url)}
          onClick={() => setEditing((open) => !open)}
        >
          <FontAwesomeIcon icon={faPen} aria-hidden="true" /> {editing ? 'Done' : 'Edit video'}
        </button>
      </CardActions>
    </NodeViewWrapper>
  );
}
