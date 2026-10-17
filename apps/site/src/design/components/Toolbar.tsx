/** Port of packages/ui/src/components/Toolbar.tsx and workbench.css.
 * Flexible bases round to scale tokens. Custom controls retain their own chrome inside a target wrapper. */
import { Children, isValidElement, type ReactNode } from 'react';
import { styled } from '@tamagui/core';
import { XStack, YStack } from '@tamagui/stacks';
import { SizableText } from '@tamagui/text';
import { focus } from '../tokens';
import { VisuallyHidden } from './VisuallyHidden';

export type ToolbarProps = {
  readonly label: string;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
  readonly action?: string;
  readonly method?: 'get' | 'post';
  readonly preservedParams?: Readonly<Record<string, string>>;
  readonly role?: 'search' | 'toolbar';
  readonly className?: string;
};
export type ToolbarFieldProps = {
  readonly label: string;
  readonly children: ReactNode;
  readonly labelHidden?: boolean;
  readonly className?: string;
};
const Frame = styled(XStack, {
  name: 'Toolbar',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  rowGap: '$3',
  columnGap: '$4',
  marginBottom: '$4',
});
const Group = styled(XStack, {
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  rowGap: '$2',
  columnGap: '$3',
  variants: {
    controls: { true: { flexGrow: 1, flexShrink: 1, flexBasis: '$48', minWidth: 0 } },
  } as const,
});
const Field = styled(YStack, {
  name: 'ToolbarField',
  render: 'label',
  gap: '$1',
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: '$48',
  minWidth: 0,
  minHeight: '$touch',
  focusWithinStyle: {
    outlineColor: '$focusRing',
    outlineWidth: focus.width,
    outlineOffset: focus.offset,
    outlineStyle: 'solid',
  },
});
const FieldLabel = styled(SizableText, {
  render: 'span',
  fontFamily: '$mono',
  fontSize: '$micro',
  fontWeight: '600',
  textTransform: 'uppercase',
  color: '$inkMuted',
});
const Control = styled(SizableText, {
  fontFamily: '$body',
  fontSize: '$bodySm',
  color: '$ink',
  minHeight: '$touch',
  paddingVertical: '$2',
  paddingHorizontal: '$3',
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$sm',
  backgroundColor: '$surfaceRaised',
  focusVisibleStyle: {
    outlineColor: '$focusRing',
    outlineWidth: focus.width,
    outlineOffset: focus.offset,
    outlineStyle: 'solid',
  },
});
export function Toolbar({
  label,
  children,
  actions,
  action,
  method = 'get',
  preservedParams,
  role,
  className,
}: ToolbarProps) {
  const body = (
    <>
      <Group controls>{children}</Group>
      {actions ? <Group>{actions}</Group> : null}
    </>
  );
  if (!action)
    return (
      <Frame
        render="div"
        className={className}
        role={role ?? 'toolbar'}
        aria-label={label}
        aria-orientation="horizontal"
      >
        {body}
      </Frame>
    );
  return (
    <Frame
      render="form"
      {...{ action, method }}
      className={className}
      role={role ?? 'search'}
      aria-label={label}
    >
      {Object.entries(preservedParams ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {body}
    </Frame>
  );
}
export function ToolbarField({ label, children, labelHidden, className }: ToolbarFieldProps) {
  return (
    <Field className={className}>
      {labelHidden ? <VisuallyHidden>{label}</VisuallyHidden> : <FieldLabel>{label}</FieldLabel>}
      <YStack minHeight="$touch">
        {Children.map(children, (child) =>
          isValidElement<{ children?: ReactNode }>(child) &&
          (child.type === 'input' || child.type === 'select') ? (
            <Control render={child}>{child.props.children}</Control>
          ) : (
            child
          ),
        )}
      </YStack>
    </Field>
  );
}
