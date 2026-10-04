/**
 * The run of Next presses on entity pages, kept so in-app Back can tell when the previous record
 * is also the previous history entry. Pure; storage lives in the client component.
 */
/** One Next press: the record left and the record it opened. */
export type NextHop = { readonly from: string; readonly to: string };

/**
 * The run of Next presses that led here, oldest first. Each in-app Back that matches the last hop
 * is a real history step (`router.back()`), so the whole chain A→B→C unwinds through history
 * instead of only its last hop.
 */
export function appendNextHop(chain: readonly NextHop[], hop: NextHop): NextHop[] {
  const last = chain[chain.length - 1];
  // A Next from somewhere the chain does not end is a new run; the old one is no longer history.
  return last && last.to === hop.from ? [...chain, hop] : [hop];
}

/** The record the reader came from by Next, if the chain ends here. */
export function nextHopInto(chain: readonly NextHop[], currentId: string): string | null {
  const last = chain[chain.length - 1];
  return last && last.to === currentId ? last.from : null;
}
