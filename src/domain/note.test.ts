import { describe, expect, it } from 'vitest';
import {
  deriveNoteSnippet,
  deriveNoteTitle,
  matchesNoteSearch,
  normalizeSupportedMarkdown,
  sortNotesByUpdatedTime,
  toggleTaskAtIndex,
  type Note
} from './note';

describe('Note title', () => {
  it('uses the first Markdown heading as the note title', () => {
    expect(deriveNoteTitle('intro\n\n##  買い物メモ  ##\n本文')).toBe('買い物メモ');
  });

  it('falls back to the first non-empty line without Markdown chrome', () => {
    expect(deriveNoteTitle('\n- [x] メール返信\n# 後の見出し')).toBe('後の見出し');
  });

  it('uses supported inline Markdown text without formatting markers', () => {
    expect(deriveNoteTitle('**重要** [仕様](https://example.com/spec)')).toBe('重要 仕様');
  });

  it('shows untitled when a note has no usable text', () => {
    expect(deriveNoteTitle(' \n\t\n')).toBe('無題');
  });
});

describe('Note snippet', () => {
  it('summarizes note text without task and list markers', () => {
    expect(deriveNoteSnippet('# 今日\n- [ ] 買い物\n- メモ')).toBe('今日 買い物 メモ');
  });

  it('summarizes supported inline Markdown as readable text', () => {
    expect(deriveNoteSnippet('**重要**: [仕様](https://example.com/spec)を見る')).toBe(
      '重要: 仕様を見る'
    );
  });

  it('keeps snippets short for the note list', () => {
    const snippet = deriveNoteSnippet('a'.repeat(120));

    expect(snippet).toHaveLength(99);
    expect(snippet.endsWith('...')).toBe(true);
  });
});

describe('Note order', () => {
  it('shows recently edited notes first without mutating the input', () => {
    const oldNote = note('old', 'old', '2026-05-01T00:00:00.000Z');
    const newNote = note('new', 'new', '2026-05-02T00:00:00.000Z');
    const notes = [oldNote, newNote];

    expect(sortNotesByUpdatedTime(notes).map((item) => item.id)).toEqual(['new', 'old']);
    expect(notes.map((item) => item.id)).toEqual(['old', 'new']);
  });
});

describe('Note search', () => {
  it('matches note text by case-insensitive partial query', () => {
    expect(matchesNoteSearch(note('1', 'Buy Milk'), ' milk ')).toBe(true);
    expect(matchesNoteSearch(note('1', 'Buy Milk'), 'coffee')).toBe(false);
  });

  it('keeps all notes visible for an empty query', () => {
    expect(matchesNoteSearch(note('1', 'Buy Milk'), '   ')).toBe(true);
  });
});

describe('Supported Markdown normalization', () => {
  it('converts first-class bullet and task shapes to the stored form', () => {
    expect(normalizeSupportedMarkdown('* [ ] task\n  * [X] done\n* bullet\n- [X] already')).toBe(
      '- [ ] task\n  - [x] done\n- bullet\n- [x] already'
    );
  });
});

describe('Task toggling', () => {
  it('toggles the selected task in note text and leaves other lines intact', () => {
    const markdown = '- [ ] first\nparagraph\n  * [X] second';

    expect(toggleTaskAtIndex(markdown, 1)).toBe('- [ ] first\nparagraph\n  * [ ] second');
  });

  it('leaves note text unchanged when no task exists at that index', () => {
    expect(toggleTaskAtIndex('- [ ] only task', 2)).toBe('- [ ] only task');
  });
});

function note(id: string, markdown: string, updatedAt = '2026-05-01T00:00:00.000Z'): Note {
  return { id, markdown, updatedAt };
}
