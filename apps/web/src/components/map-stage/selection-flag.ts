/**
 * The selected record's callout on the plate: the shared `.ds-map-callout` (shell.css), the same
 * paper card home hangs on its spotlight record. The record's name in Schibsted, one mono-caps meta
 * line (kind and decade) and a 1px ink leader down to the pin. A DOM marker, because map glyphs
 * cannot set the house faces. Shown only for a record that has a drawn mark; a county- or
 * state-precision record has no point to attach to, and its tag turns copper instead.
 */
export function buildSelectionFlagElement(name: string, meta?: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'ds-map-callout ds-map-callout--flag';
  // The inspector already names the selection for assistive tech; the callout is its visual echo.
  root.setAttribute('aria-hidden', 'true');
  const card = document.createElement('div');
  card.className = 'ds-map-callout__card';
  card.dataset.ground = 'paper';
  const body = document.createElement('div');
  body.className = 'ds-map-callout__body';
  const label = document.createElement('span');
  label.className = 'ds-map-callout__name';
  label.textContent = name;
  body.append(label);
  if (meta) {
    const line = document.createElement('span');
    line.className = 'ds-map-callout__meta';
    line.textContent = meta;
    body.append(line);
  }
  card.append(body);
  const leader = document.createElement('span');
  leader.className = 'ds-map-callout__leader';
  root.append(card, leader);
  return root;
}
