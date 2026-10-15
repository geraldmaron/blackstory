'use client';
import { Children, isValidElement, useId, useState, useRef, useImperativeHandle } from 'react';
import type React from 'react';
import { Button } from 'baseui/button';
import { styled } from 'baseui';
const CheckboxRoot = styled('span', {});
import { Checkbox } from 'baseui/checkbox';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Textarea } from 'baseui/textarea';
import { Select } from 'baseui/select';
export function TextField({
  label,
  value,
  onChange,
  disabled = false,
  caption,
  type = 'text',
  name,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  caption?: string;
  type?: string;
  name?: string;
  min?: number;
}) {
  const id = useId();
  return (
    <FormControl
      label={label}
      caption={caption}
      htmlFor={id}
      overrides={{ Caption: { props: { id: `${id}-caption` } } }}
    >
      <Input
        size="compact"
        id={id}
        overrides={{
          Input: { props: { 'aria-describedby': caption ? `${id}-caption` : undefined } },
        }}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
        type={type}
        {...(name === undefined ? {} : { name })}
        {...(min === undefined ? {} : { min })}
      />
    </FormControl>
  );
}
export function TextAreaField({
  label,
  value,
  onChange,
  disabled = false,
  caption,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  caption?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <FormControl
      label={label}
      caption={caption}
      htmlFor={id}
      overrides={{ Caption: { props: { id: `${id}-caption` } } }}
    >
      <Textarea
        size="compact"
        id={id}
        overrides={{
          Input: { props: { 'aria-describedby': caption ? `${id}-caption` : undefined } },
        }}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
        rows={rows}
      />
    </FormControl>
  );
}
export function ChoiceField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  caption,
  searchable = true,
}: {
  label: string;
  value: string;
  options: { id: string; label: string; disabled?: boolean }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  caption?: string;
  searchable?: boolean;
}) {
  const id = useId(),
    selected = options.filter((option) => option.id === value);
  return (
    <FormControl
      label={label}
      caption={caption}
      htmlFor={id}
      overrides={{ Caption: { props: { id: `${id}-caption` } } }}
    >
      <Select
        size="compact"
        id={id}
        overrides={{
          Input: { props: { 'aria-describedby': caption ? `${id}-caption` : undefined } },
        }}
        aria-label={label}
        options={options}
        value={selected}
        placeholder="Choose an option"
        onChange={({ value: next }) => onChange(String(next[0]?.id ?? ''))}
        disabled={disabled}
        clearable={false}
        searchable={searchable}
      />
    </FormControl>
  );
}

/** FormData adapters let existing audited server actions use the same Base controls. */
export function FormInput(props: Omit<React.ComponentPropsWithRef<'input'>, 'size'>) {
  const [local, setLocal] = useState(props.defaultValue ?? '');
  const [checked, setChecked] = useState(props.defaultChecked ?? false);
  const controlRef = useRef<HTMLInputElement>(null!);
  useImperativeHandle(props.ref, () => controlRef.current);

  const forwarded = { ...props };
  delete forwarded.onChange;
  delete forwarded.defaultValue;
  delete forwarded.value;
  delete forwarded.checked;
  delete forwarded.defaultChecked;
  delete forwarded.ref;
  if (props.type === 'hidden' || props.type === 'file') return <input {...props} />;
  if (props.type === 'checkbox')
    return (
      <Checkbox
        inputRef={controlRef}
        checked={props.checked ?? checked}
        disabled={props.disabled ?? false}
        {...(props.name ? { name: props.name } : {})}
        {...(props.value !== undefined ? { value: String(props.value) } : {})}
        {...(props.id ? { id: props.id } : {})}
        {...(props['aria-label'] ? { 'aria-label': props['aria-label'] } : {})}
        overrides={{ Root: { component: CheckboxRoot }, Input: { props: forwarded } }}
        onChange={(event) => {
          setChecked(event.currentTarget.checked);
          props.onChange?.(event);
        }}
      />
    );
  return (
    <Input
      inputRef={controlRef}
      size="compact"
      value={String(props.value ?? local)}
      disabled={props.disabled ?? false}
      type={props.type ?? 'text'}
      overrides={{ Input: { props: forwarded } }}
      onChange={(event) => {
        setLocal(event.currentTarget.value);
        props.onChange?.(event as React.ChangeEvent<HTMLInputElement>);
      }}
    />
  );
}
export function FormTextarea(props: React.ComponentPropsWithRef<'textarea'>) {
  const controlRef = useRef<HTMLTextAreaElement>(null!);
  useImperativeHandle(props.ref, () => controlRef.current);
  const [local, setLocal] = useState(props.defaultValue ?? '');
  const forwarded = { ...props };
  delete forwarded.onChange;
  delete forwarded.defaultValue;
  delete forwarded.value;
  delete forwarded.ref;
  return (
    <Textarea
      inputRef={controlRef}
      size="compact"
      value={String(props.value ?? local)}
      disabled={props.disabled ?? false}
      rows={props.rows ?? 4}
      overrides={{ Input: { props: forwarded } }}
      onChange={(event) => {
        setLocal(event.currentTarget.value);
        props.onChange?.(event as React.ChangeEvent<HTMLTextAreaElement>);
      }}
    />
  );
}
export function FormButton({ className, ...props }: React.ComponentPropsWithRef<'button'>) {
  return (
    <Button
      size="compact"
      {...(props as React.ComponentProps<typeof Button>)}
      type={props.type ?? 'submit'}
      kind={className?.includes('--primary') ? 'primary' : 'secondary'}
      overrides={{ BaseButton: { props: { className } } }}
    />
  );
}
export function FormSelect({
  value,
  defaultValue,
  onValueChange,
  children,
  name,
  disabled,
  id,
  ...aria
}: {
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  name?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}) {
  const [local, setLocal] = useState<string | undefined>(
    defaultValue === undefined ? undefined : String(defaultValue),
  );
  const options: { id: string; label: string; disabled: boolean }[] = [];
  function collect(nodes: React.ReactNode) {
    Children.forEach(nodes, (node) => {
      if (
        !isValidElement<{
          value?: string | number;
          children?: React.ReactNode;
          disabled?: boolean;
        }>(node)
      )
        return;
      if (node.type === 'option')
        options.push({
          id: String(node.props.value ?? node.props.children ?? ''),
          label: Children.toArray(node.props.children).join(''),
          disabled: !!node.props.disabled,
        });
      else collect(node.props.children);
    });
  }
  collect(children);
  const selected = String(value ?? local ?? options[0]?.id ?? '');
  return (
    <>
      <Select
        size="compact"
        {...aria}
        {...(id ? { id } : {})}
        disabled={disabled ?? false}
        clearable={false}
        searchable={true}
        options={options}
        value={options.filter((option) => option.id === selected)}
        onChange={({ value: next }) => {
          const nextValue = String(next[0]?.id ?? '');
          setLocal(nextValue);
          onValueChange?.(nextValue);
        }}
      />
      {name && <input type="hidden" name={name} value={selected} disabled={disabled} />}
    </>
  );
}
