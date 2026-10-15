'use client';
import type { ArticleBodyBlockDoc } from '@repo/schemas';
import { Button } from 'baseui/button';
import { TextField, TextAreaField, ChoiceField } from '../design-system/fields';
type Value = string | number | boolean | null | Value[] | { [key: string]: Value | undefined };
const labels: Record<string, string> = {
  text: 'Text',
  alt: 'Image description',
  credit: 'Image credit',
  caption: 'Caption',
  attribution: 'Attribution',
  image: 'Image',
  anchors: 'Evidence anchors',
  quote: 'Quotation',
  type: 'Type',
  level: 'Heading level',
  style: 'List style',
  items: 'One item per line',
  entityId: 'Entity record',
  packetId: 'Evidence packet',
  refId: 'Evidence row',
  metricIds: 'Metric IDs',
  claimId: 'Claim',
  claimVersionId: 'Claim version',
  selectorId: 'Evidence selector',
  url: 'Source URL',
  label: 'Label',
  rightsStatus: 'Rights',
  sideA: 'First account',
  sideB: 'Second account',
  sourceLabel: 'Source name',
};
const choices: Record<string, string[]> = {
  style: ['bullet', 'number'],
  rightsStatus: ['public_domain', 'licensed', 'fair_use'],
  kind: ['observation', 'derived'],
};
function Fields({
  value,
  onChange,
  path,
  disabled = false,
}: {
  value: Record<string, Value | undefined>;
  onChange: (value: Record<string, Value | undefined>) => void;
  path: string;
  disabled?: boolean;
}) {
  return (
    <>
      {Object.entries(value)
        .filter(([key]) => !['type', 'replicationVerified'].includes(key))
        .map(([key, item]) => {
          const label = labels[key] ?? key.replace(/([A-Z])/g, ' $1'),
            change = (next: Value | undefined) => onChange({ ...value, [key]: next });
          if (
            Array.isArray(item) &&
            (key === 'anchors' || item.some((entry) => typeof entry === 'object'))
          )
            return (
              <fieldset key={key}>
                <legend>{label}</legend>
                {item.map((entry, index) => (
                  <div key={index}>
                    <Fields
                      disabled={disabled}
                      value={entry as Record<string, Value>}
                      path={`${path}-${key}-${index}`}
                      onChange={(next) => change(item.map((v, i) => (i === index ? next : v)))}
                    />
                    <Button
                      kind="tertiary"
                      size="compact"
                      disabled={disabled}
                      onClick={() => change(item.filter((_, i) => i !== index))}
                    >
                      Remove evidence anchor {index + 1}
                    </Button>
                  </div>
                ))}
                <Button
                  kind="secondary"
                  size="compact"
                  disabled={disabled}
                  onClick={() =>
                    change([
                      ...item,
                      { url: '', label: '', claimId: '', claimVersionId: '', selectorId: '' },
                    ])
                  }
                >
                  Add evidence anchor
                </Button>
              </fieldset>
            );
          if (item && typeof item === 'object' && !Array.isArray(item))
            return (
              <fieldset key={key}>
                <legend>{label}</legend>
                <Fields
                  disabled={disabled}
                  value={item}
                  path={`${path}-${key}`}
                  onChange={change}
                />
              </fieldset>
            );
          if (choices[key])
            return (
              <ChoiceField
                key={key}
                label={label}
                value={String(item ?? '')}
                disabled={disabled}
                options={choices[key]!.map((id) => ({ id, label: id.replaceAll('_', ' ') }))}
                onChange={change}
              />
            );
          if (key === 'level')
            return (
              <ChoiceField
                key={key}
                label={label}
                value={String(item)}
                disabled={disabled}
                options={[
                  { id: '2', label: 'Section' },
                  { id: '3', label: 'Subsection' },
                ]}
                onChange={(next) => change(Number(next))}
              />
            );
          if (typeof item === 'number')
            return (
              <TextField
                key={key}
                label={label}
                value={String(item)}
                type="number"
                disabled={disabled}
                onChange={(next) => change(Number(next))}
              />
            );
          if (
            !Array.isArray(item) &&
            !['text', 'claim', 'caption', 'quote', 'attribution', 'alt'].includes(key)
          )
            return (
              <TextField
                key={key}
                label={label}
                disabled={disabled}
                value={String(item ?? '')}
                onChange={change}
              />
            );
          return (
            <TextAreaField
              key={key}
              label={label}
              disabled={disabled}
              rows={key === 'text' ? 5 : 2}
              value={Array.isArray(item) ? item.join('\n') : String(item ?? '')}
              onChange={(next) => change(Array.isArray(item) ? next.split('\n') : next)}
            />
          );
        })}
    </>
  );
}
export const newBlock = (type: ArticleBodyBlockDoc['type']): ArticleBodyBlockDoc => {
  const blocks: Record<ArticleBodyBlockDoc['type'], unknown> = {
    paragraph: { type, text: '' },
    heading: { type, level: 2, text: '' },
    list: { type, style: 'bullet', items: [] },
    pullquote: { type, text: '', attribution: '', anchors: [] },
    figure: { type, packetId: '', caption: '', anchors: [] },
    stat: { type, packetId: '', kind: 'observation', refId: '', caption: '', anchors: [] },
    primaryDocument: { type, packetId: '', refId: '', quote: '' },
    timeline: { type, packetId: '' },
    mapInset: { type, entityId: '' },
    dispute: {
      type,
      label: '',
      sideA: { sourceLabel: '', claim: '' },
      sideB: { sourceLabel: '', claim: '' },
    },
    image: {
      type,
      image: { url: '', alt: '', credit: '', rightsStatus: 'public_domain' },
      caption: '',
    },
  };
  return blocks[type] as ArticleBodyBlockDoc;
};
const optionalFields: Partial<Record<ArticleBodyBlockDoc['type'], Record<string, Value>>> = {
  pullquote: { attribution: '', anchors: [] },
  figure: { metricIds: [], anchors: [] },
  stat: { caption: '', anchors: [] },
  primaryDocument: { quote: '' },
  mapInset: { label: '' },
  image: { caption: '' },
};
export function BlockEditor({
  block,
  disabled = false,
  index,
  onChange,
  move,
  remove,
}: {
  block: ArticleBodyBlockDoc;
  disabled?: boolean;
  index: number;
  onChange: (b: ArticleBodyBlockDoc) => void;
  move: (d: number) => void;
  remove: () => void;
}) {
  return (
    <fieldset className="editorial-block" disabled={disabled}>
      <legend>
        {index + 1}. {block.type}
      </legend>
      <Fields
        disabled={disabled}
        value={{ ...newBlock(block.type), ...block } as unknown as Record<string, Value>}
        path={`block-${index}`}
        onChange={(v) => onChange(v as unknown as ArticleBodyBlockDoc)}
      />
      {Object.keys(optionalFields[block.type] ?? {}).some((key) => !(key in block)) && (
        <ChoiceField
          label="Add an optional field"
          disabled={disabled}
          value=""
          options={[
            { id: '', label: 'Choose a field' },
            ...Object.keys(optionalFields[block.type] ?? {})
              .filter((key) => !(key in block))
              .map((id) => ({ id, label: labels[id] ?? id })),
          ]}
          onChange={(key) => {
            if (key)
              onChange({
                ...block,
                [key]: optionalFields[block.type]![key],
              } as ArticleBodyBlockDoc);
          }}
        />
      )}
      <div className="editorial-actions">
        <Button
          kind="tertiary"
          size="compact"
          onClick={() => move(-1)}
          disabled={disabled || index === 0}
        >
          Move up
        </Button>
        <Button kind="tertiary" size="compact" disabled={disabled} onClick={() => move(1)}>
          Move down
        </Button>
        <Button kind="tertiary" size="compact" disabled={disabled} onClick={remove}>
          Remove block
        </Button>
      </div>
    </fieldset>
  );
}
