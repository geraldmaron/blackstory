# BlackStory design system (Tamagui)

One set of tokens and one kit of components for web now and native later. Nothing under `src/design` imports
from the rest of `apps/site`, so the folder moves to `packages/design` unchanged when mobile adopts it
(`repo-v0lfu`, tasks `repo-nhbo3` and `repo-8vkuz`).

## Where values come from

```
packages/ui/src/styles/tokens.css   what ships (the source of values)
        │  npm run design:tokens    scripts/generate-design-tokens.mjs
        ▼
src/design/generated/tokens.ts      GENERATED, committed, never edited by hand
        ▼
src/design/tokens.ts                typed façade (+ breakpoints from packages/ui/src/tokens/spacing.ts)
        ▼
src/design/config.ts                createTamagui(): themes, tokens, fonts, media
```

`test/design/tokens.test.ts` fails if the generated file is stale, lists the known drift between
`packages/ui/src/tokens/colors.ts` and the CSS (15 colors and the medium radius), and lists the shipped text
pairs below WCAG AA (`dark confidence-low`, 4.29:1). Both lists are exact: a new problem fails, and fixing one
means deleting its line.

## Using tokens

| Want                | Write                                                                                                                                               | Not                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| a color             | a theme role: `$canvas`, `$surface`, `$ink`, `$inkMuted`, `$accent`, `$border`, `$warningFg`, `$confidenceHighBg` ... (named like `--ds-ink-muted`) | a hex, `rgb()`, a brand swatch |
| space, gap, padding | scale steps `$1 $2 $3 $4 $5 $6 $8 $10 $12 $16 $24 $32 $48` (4 px rhythm, `$4` is 16 px)                                                             | `padding={12}`                 |
| a minimum target    | `minHeight="$touch"` (44 px)                                                                                                                        | `minHeight={44}`               |
| radius              | `$sm` (8), `$md` (14), `$lg` (28), `$full`                                                                                                          | `borderRadius={14}`            |
| type size           | `fontSize="$caption"`, `$bodySm`, `$body`, `$subtitle`, `$title`, `$display3` ...                                                                   | `fontSize={13}`                |
| type family         | `fontFamily="$body"` (Geist), `$heading` (Schibsted Grotesk), `$editorial` (Newsreader), `$mono` (Geist Mono)                                       | a font string                  |
| breakpoint          | media props `$gtMd`, `$maxMd` (grid: 640, 768, 1024, 1280)                                                                                          | `@media` literals              |
| a hairline          | `borderWidth={1}` (and `2` for strong)                                                                                                              | `borderWidth={3}`              |

`npm run lint:design` enforces this over `src/design` (color literals, numeric size/space props above 2, unit
strings, `tag=`, inline `style={{}}`). A line can opt out with `// design-lint-allow: <reason>`.

## Writing a component

Start from `components/Confidence.tsx`, the reference. Every component:

1. **Is a `styled()` frame plus `variants`.** Variants are named for meaning (`tone`, `level`, `variant`), not for
   appearance. Sizes and colors resolve to tokens.
2. **Renders real semantics.** `render="nav" | "header" | "section" | "article" | "button" | "a"` for the element;
   landmarks get an `aria-label`; status and alert roles are set where the source component sets them. Tamagui 2
   uses `render`, not `tag` (a `tag` prop silently renders `<div tag=..>`).
3. **Never relies on color alone.** A status has text or a glyph that carries the meaning (see Notice cues and the
   Confidence marks). Purely visual glyphs are `aria-hidden`.
4. **Meets targets.** Anything interactive has `minHeight="$touch"` and, where it is a link or button, a visible
   focus state (`focusVisibleStyle` using `$focusRing`).
5. **Works in both themes** without knowing which one it is.
6. **Has a test** in `test/design/<Name>.test.tsx` using `render()` from `./testing`: semantics (tags, roles,
   labels, text), behavior (props to output), and that colors are roles (`var(--<role>)` in the CSS, no literal
   in the markup). Run both themes for anything colored.
7. **Is exported** from `src/design/index.ts`.
8. **Names its source.** The header comment says which `packages/ui` or `apps/web` component and CSS it ports, and
   lists any deliberate difference.

## Testing

```bash
npm test                      # unit, edge, data and design tests
npm run lint                  # eslint + design lint
npm run design:tokens         # regenerate tokens after tokens.css changes
```

`render(<Component />, 'light' | 'dark')` returns `{ html, raw, text(), tags(name), attr(tag, name) }`.
Tamagui renders to HTML under Node, so semantics are asserted on markup. Pixels belong to the Playwright baseline
(`packages/testing/src/visual`), not to these tests. The TypeScript project in `apps/site` does not type check
Tamagui style props (filed bug), so tests and lint are the safety net: write the test as if the compiler will not
catch a wrong prop name.
