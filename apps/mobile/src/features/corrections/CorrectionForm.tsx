/**
 * Correction intake form (MOB-016 #1). Category/target pickers, description,
 * a required HTTPS evidence URL, optional contact with an AFFIRMATIVE (never
 * pre-checked) contact-consent step, and the required privacy-notice consent.
 *
 * The form root is a plain `View` — the surrounding `UtilityScreenShell` owns the
 * single scroll container, so there is no nested scroller inside the shell's own
 * clipped, already-scrolling Surface (MOB-017).
 *
 * All field state is in-memory only for the lifetime of the modal — it is
 * deliberately NOT persisted across app restarts (MOB-016 #6: no encrypted
 * draft feature; the simplest safe choice is no on-disk draft, so correction
 * content never touches the general cache). Nothing here is passed through the
 * router / a URL param (invariant 7).
 */
import { forwardRef, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  Button,
  CorrectionTextField,
  Notice,
  Text,
  radius,
  space,
  useStatusColors,
  useThemeColors,
} from '@/ui';
import type { SubmitResult } from './client';
import {
  CONTACT_CONSENT_LABEL,
  CORRECTION_PRIVACY_NOTICE,
  PRIVACY_CONSENT_LABEL,
  GENERIC_SUBMIT_ERROR,
  OFFLINE_MESSAGE,
  RATE_LIMITED_MESSAGE,
} from './copy';
import {
  CORRECTION_CATEGORY_LABELS,
  CORRECTION_TARGET_LABELS,
  type CorrectionCategory,
  type CorrectionTargetType,
} from './categories';
import {
  EMPTY_CORRECTION_FORM,
  MAX_CONTACT_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_SOURCE_URL_LENGTH,
  MAX_TARGET_ID_LENGTH,
  validateCorrectionForm,
  type CorrectionFieldIssue,
  type CorrectionFormState,
} from './validation';

/** Apple HIG / Material minimum touch target (dp), mirrored from `@/ui/Button.tsx`'s own
 * constant — this form's hand-rolled `ChipRow`/`Checkbox` controls are not built on `Button`
 * (they need radio/checkbox semantics `Button` doesn't expose), so they enforce the same 44pt
 * floor directly rather than silently falling short of it (MOB-017). */
const MIN_TOUCH_TARGET = 44;

/** Glyph size (dp) for the checkbox tick — sized off the token scale, not font fallback. */
const CHECKBOX_GLYPH = 22;

export type CorrectionFormProps = {
  /** Optional record context — pre-fills the target id (validated upstream). */
  readonly entityId?: string | undefined;
  /** Shell-owned ScrollView ref for scroll-to-first-error after validation. */
  readonly scrollRef?: RefObject<ScrollView | null> | undefined;
  /** Network submit — injected by the route so the form stays transport-free. */
  readonly onSubmit: (state: CorrectionFormState) => Promise<SubmitResult>;
  /** Called with the opaque receipt once the server accepts the submission. */
  readonly onAccepted: (receiptCode: string) => void;
};

function issueFor(issues: readonly CorrectionFieldIssue[], field: string): string | undefined {
  return issues.find((issue) => issue.field === field)?.message;
}

function announceFirstIssue(issues: readonly CorrectionFieldIssue[]) {
  const first = issues[0];
  if (first) AccessibilityInfo.announceForAccessibility(first.message);
}

type FieldAnchorKey =
  | 'targetType'
  | 'category'
  | 'targetRecordId'
  | 'statement'
  | 'sourceUrl'
  | 'contact'
  | 'contactConsent'
  | 'privacyConsent';

function scrollFieldIntoView(
  scrollRef: RefObject<ScrollView | null>,
  fieldRef: RefObject<View | null>,
  inset = space['3'],
) {
  const scrollView = scrollRef.current;
  const field = fieldRef.current;
  if (!scrollView || !field) return;

  const relativeTo =
    'getInnerViewRef' in scrollView && typeof scrollView.getInnerViewRef === 'function'
      ? scrollView.getInnerViewRef()
      : scrollView;

  field.measureLayout(
    relativeTo as unknown as number,
    (_left, top) => {
      scrollView.scrollTo({ y: Math.max(0, top - inset), animated: true });
    },
    () => {},
  );
}

function scrollToFirstIssue(
  issues: readonly CorrectionFieldIssue[],
  scrollRef: RefObject<ScrollView | null> | undefined,
  fieldRefs: Record<FieldAnchorKey, RefObject<View | null>>,
) {
  const first = issues[0];
  if (!first || !scrollRef) return;
  const fieldKey = first.field as FieldAnchorKey;
  const fieldRef = fieldRefs[fieldKey];
  if (!fieldRef) return;
  requestAnimationFrame(() => {
    scrollFieldIntoView(scrollRef, fieldRef);
  });
}

export function CorrectionForm({ entityId, scrollRef, onSubmit, onAccepted }: CorrectionFormProps) {
  const [state, setState] = useState<CorrectionFormState>({
    ...EMPTY_CORRECTION_FORM,
    targetRecordId: entityId ?? '',
    ...(entityId ? { targetType: 'entity' as const } : {}),
  });
  const [issues, setIssues] = useState<readonly CorrectionFieldIssue[]>([]);
  const [banner, setBanner] = useState<{ tone: 'error' | 'warning'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Focus chain: record id → URL → contact.
  const urlRef = useRef<TextInput>(null);
  const contactRef = useRef<TextInput>(null);
  const fieldRefs = {
    targetType: useRef<View>(null),
    category: useRef<View>(null),
    targetRecordId: useRef<View>(null),
    statement: useRef<View>(null),
    sourceUrl: useRef<View>(null),
    contact: useRef<View>(null),
    contactConsent: useRef<View>(null),
    privacyConsent: useRef<View>(null),
  } satisfies Record<FieldAnchorKey, RefObject<View | null>>;

  function reportIssues(nextIssues: readonly CorrectionFieldIssue[]) {
    setIssues(nextIssues);
    announceFirstIssue(nextIssues);
    scrollToFirstIssue(nextIssues, scrollRef, fieldRefs);
  }

  function patch(next: Partial<CorrectionFormState>) {
    setState((prev) => ({ ...prev, ...next }));
    // Clear any validation error on a field the user is actively correcting, so a
    // fixed field stops reading as invalid instead of staying red until re-submit.
    const patched = Object.keys(next);
    setIssues((prev) => prev.filter((issue) => !patched.includes(issue.field)));
  }

  async function handleSubmit() {
    setBanner(null);
    const local = validateCorrectionForm(state);
    if (!local.valid) {
      reportIssues(local.issues);
      return;
    }
    setIssues([]);
    setBusy(true);
    try {
      const result = await onSubmit(state);
      switch (result.status) {
        case 'accepted':
          onAccepted(result.receiptCode);
          return;
        case 'invalid':
          reportIssues(result.issues);
          return;
        case 'offline':
          setBanner({ tone: 'warning', text: OFFLINE_MESSAGE });
          return;
        case 'rate_limited':
          setBanner({ tone: 'warning', text: RATE_LIMITED_MESSAGE });
          return;
        default:
          setBanner({ tone: 'error', text: GENERIC_SUBMIT_ERROR });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space['3'] }}>
      <Notice tone="info" title={CORRECTION_PRIVACY_NOTICE.title} description={CORRECTION_PRIVACY_NOTICE.body} />

      <Field ref={fieldRefs.targetType} label="What are you correcting?" error={issueFor(issues, 'targetType')}>
        <ChipRow<CorrectionTargetType>
          values={Object.keys(CORRECTION_TARGET_LABELS) as CorrectionTargetType[]}
          selected={state.targetType || undefined}
          labelFor={(v) => CORRECTION_TARGET_LABELS[v]}
          onSelect={(v) => patch({ targetType: v })}
        />
      </Field>

      <Field ref={fieldRefs.category} label="Category" error={issueFor(issues, 'category')}>
        <ChipRow<CorrectionCategory>
          values={Object.keys(CORRECTION_CATEGORY_LABELS) as CorrectionCategory[]}
          selected={state.category || undefined}
          labelFor={(v) => CORRECTION_CATEGORY_LABELS[v]}
          onSelect={(v) => patch({ category: v })}
        />
      </Field>

      <Field ref={fieldRefs.targetRecordId} label="Record identifier" error={issueFor(issues, 'targetRecordId')}>
        <CorrectionTextField
          value={state.targetRecordId}
          onChangeText={(t) => patch({ targetRecordId: t })}
          placeholder="e.g. ent_caam_los_angeles_001"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={MAX_TARGET_ID_LENGTH}
          returnKeyType="next"
          onSubmitEditing={() => urlRef.current?.focus()}
          accessibilityLabel="Record identifier"
          invalid={Boolean(issueFor(issues, 'targetRecordId'))}
        />
      </Field>

      <Field ref={fieldRefs.statement} label="Describe the correction" error={issueFor(issues, 'statement')}>
        <CorrectionTextField
          value={state.statement}
          onChangeText={(t) => patch({ statement: t })}
          placeholder="What is wrong, and what should it say?"
          multiline
          numberOfLines={6}
          maxLength={MAX_FIELD_LENGTH}
          accessibilityLabel="Correction details"
          invalid={Boolean(issueFor(issues, 'statement'))}
          style={{ minHeight: 140 }}
        />
      </Field>

      <Field ref={fieldRefs.sourceUrl} label="Supporting HTTPS source URL" error={issueFor(issues, 'sourceUrl')}>
        <CorrectionTextField
          ref={urlRef}
          value={state.sourceUrl}
          onChangeText={(t) => patch({ sourceUrl: t })}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          textContentType="URL"
          autoComplete="url"
          maxLength={MAX_SOURCE_URL_LENGTH}
          returnKeyType="next"
          onSubmitEditing={() => contactRef.current?.focus()}
          accessibilityLabel="Supporting HTTPS source URL"
          invalid={Boolean(issueFor(issues, 'sourceUrl'))}
        />
      </Field>

      <Field ref={fieldRefs.contact} label="Contact (optional)" error={issueFor(issues, 'contact')}>
        <CorrectionTextField
          ref={contactRef}
          value={state.contact}
          onChangeText={(t) => patch({ contact: t })}
          placeholder="Email or handle, only if you want a reply"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          maxLength={MAX_CONTACT_LENGTH}
          returnKeyType="done"
          accessibilityLabel="Contact details (optional)"
          invalid={Boolean(issueFor(issues, 'contact'))}
        />
      </Field>

      <View ref={fieldRefs.contactConsent}>
        <Checkbox
          checked={state.contactConsent}
          onToggle={() => patch({ contactConsent: !state.contactConsent })}
          label={CONTACT_CONSENT_LABEL}
          error={issueFor(issues, 'contactConsent')}
        />
      </View>

      <View ref={fieldRefs.privacyConsent}>
        <Checkbox
          checked={state.privacyConsent}
          onToggle={() => patch({ privacyConsent: !state.privacyConsent })}
          label={PRIVACY_CONSENT_LABEL}
          error={issueFor(issues, 'privacyConsent')}
        />
      </View>

      {banner ? <Notice tone={banner.tone} title="Not submitted" description={banner.text} /> : null}

      <Button label="Submit correction" variant="primary" loading={busy} onPress={handleSubmit} />
    </View>
  );
}

const Field = forwardRef<
  View,
  {
    readonly label: string;
    readonly error?: string | undefined;
    readonly children: React.ReactNode;
  }
>(function Field({ label, error, children }, ref) {
  const status = useStatusColors();
  return (
    <View ref={ref} style={{ gap: space['1'] }}>
      <Text variant="bodyEmphasis">{label}</Text>
      {children}
      {error ? (
        <Text
          variant="bodySmall"
          style={{ color: status.error.fg }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});

function ChipRow<T extends string>({
  values,
  selected,
  labelFor,
  onSelect,
}: {
  readonly values: readonly T[];
  readonly selected: T | undefined;
  readonly labelFor: (value: T) => string;
  readonly onSelect: (value: T) => void;
}) {
  const theme = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space['2'] }}>
      {values.map((value) => {
        const isSelected = value === selected;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(value)}
            style={{
              minHeight: MIN_TOUCH_TARGET,
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: isSelected ? theme.accent : theme.border,
              backgroundColor: isSelected ? theme.surfaceRaised : 'transparent',
              borderRadius: radius.sm,
              paddingVertical: space['2'],
              paddingHorizontal: space['3'],
            }}
          >
            <Text variant="bodySmall" colorRole={isSelected ? 'accent' : 'ink'}>
              {labelFor(value)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Checkbox({
  checked,
  onToggle,
  label,
  error,
}: {
  readonly checked: boolean;
  readonly onToggle: () => void;
  readonly label: string;
  readonly error?: string | undefined;
}) {
  const theme = useThemeColors();
  const status = useStatusColors();
  return (
    <View style={{ gap: space['1'] }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          gap: space['3'],
          alignItems: 'center',
          minHeight: MIN_TOUCH_TARGET,
        }}
      >
        <View
          style={{
            width: CHECKBOX_GLYPH,
            height: CHECKBOX_GLYPH,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: checked ? theme.accent : theme.border,
            backgroundColor: checked ? theme.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? (
            <Ionicons
              name="checkmark"
              size={CHECKBOX_GLYPH - space['2']}
              color={theme.inverseInk}
              accessibilityElementsHidden
            />
          ) : null}
        </View>
        <Text variant="bodySmall" style={{ flex: 1 }}>
          {label}
        </Text>
      </Pressable>
      {error ? (
        <Text
          variant="bodySmall"
          style={{ color: status.error.fg }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
