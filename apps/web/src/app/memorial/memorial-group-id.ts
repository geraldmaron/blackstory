/** DOM id for a letter group, shared by its section and the letter jump. */
export const memorialGroupId = (letter: string) =>
  `memorial-names-${letter === '#' ? 'other' : letter}`;
