import { storyPosition } from './story-progress';

const chapters = [
  { y: 900, text: 'The count begins' },
  { y: 300, text: 'A fraction' },
];

describe('storyPosition', () => {
  it('names no chapter above the first heading', () => {
    expect(storyPosition(0, 800, 4000, chapters)).toEqual({ progress: 0, chapter: undefined });
  });

  it('names the last heading that has passed, whatever order they were measured in', () => {
    expect(storyPosition(300, 800, 4000, chapters).chapter).toBe('A fraction');
    expect(storyPosition(1600, 800, 4000, chapters).chapter).toBe('The count begins');
  });

  it('runs from 0 to 1 and stays inside it on overscroll', () => {
    expect(storyPosition(1600, 800, 4000, chapters).progress).toBe(0.5);
    expect(storyPosition(9999, 800, 4000, chapters).progress).toBe(1);
    expect(storyPosition(-50, 800, 4000, chapters).progress).toBe(0);
  });

  it('is zero when the story fits the screen', () => {
    expect(storyPosition(0, 800, 600, [])).toEqual({ progress: 0, chapter: undefined });
  });
});
