/**
 * The paper name flag on a selected pin: the record's name in Schibsted on a small paper flag,
 * attached to the pin by a short ink stem. A DOM marker, because map glyphs cannot set the house
 * display face. Shown only for a record that has a drawn mark; a county- or state-precision
 * record has no point to attach to, and its tag turns copper instead.
 */
export function buildSelectionFlagElement(name: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'ds-pin-flag';
  // The inspector already names the selection for assistive tech; the flag is its visual echo.
  root.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'ds-pin-flag__label';
  label.textContent = name;
  const stem = document.createElement('span');
  stem.className = 'ds-pin-flag__stem';
  root.append(label, stem);
  return root;
}
