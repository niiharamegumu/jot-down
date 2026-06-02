import { describe, expect, it } from 'vitest';
import {
  deriveNoteSnippet,
  deriveNoteTitle,
  duplicateNote,
  getNoteLineMovementTargetIndex,
  matchesNoteSearch,
  moveNoteLine,
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

describe('Note duplication', () => {
  it('creates a separate note with the same Markdown text', () => {
    const source = note('source', '# 買い物\n- [ ] 牛乳', '2026-05-01T00:00:00.000Z');

    const duplicated = duplicateNote(source, 'duplicate');

    expect(duplicated).toEqual(
      expect.objectContaining({
        id: 'duplicate',
        markdown: source.markdown
      })
    );
    expect(duplicated.updatedAt).not.toBe(source.updatedAt);
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

  it('converts plain web URLs to Markdown links', () => {
    expect(normalizeSupportedMarkdown('参考 https://example.com/spec を見る')).toBe(
      '参考 [https://example.com/spec](https://example.com/spec) を見る'
    );
  });

  it('converts plain web URLs embedded in Japanese note text', () => {
    expect(normalizeSupportedMarkdown('参考https://example.com/specを見る')).toBe(
      '参考[https://example.com/spec](https://example.com/spec)を見る'
    );
  });

  it('keeps existing Markdown links unchanged', () => {
    expect(
      normalizeSupportedMarkdown(
        '参考 [仕様](https://example.com/spec) と [https://example.com](https://example.com)'
      )
    ).toBe('参考 [仕様](https://example.com/spec) と [https://example.com](https://example.com)');
  });

  it('leaves trailing sentence punctuation outside generated Markdown links', () => {
    expect(normalizeSupportedMarkdown('参考 https://example.com/spec.')).toBe(
      '参考 [https://example.com/spec](https://example.com/spec).'
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

describe('Note line movement', () => {
  it('moves the selected note line up or down', () => {
    expect(moveNoteLine('A\nB\nC', 1, 'up')).toBe('B\nA\nC');
    expect(moveNoteLine('A\nB\nC', 1, 'down')).toBe('A\nC\nB');
  });

  it('leaves note text unchanged at movement boundaries', () => {
    expect(moveNoteLine('A\nB', 0, 'up')).toBe('A\nB');
    expect(moveNoteLine('A\nB', 1, 'down')).toBe('A\nB');
    expect(moveNoteLine('A\nB', 4, 'down')).toBe('A\nB');
  });

  it('carries task checked state with the moved note line', () => {
    expect(moveNoteLine('- [ ] 買い物\n- [x] メール返信', 1, 'up')).toBe(
      '- [x] メール返信\n- [ ] 買い物'
    );
  });

  it('skips blank note lines when moving non-empty note lines', () => {
    expect(moveNoteLine('A\n\nB', 2, 'up')).toBe('B\n\nA');
    expect(moveNoteLine('A\n\nB', 0, 'down')).toBe('B\n\nA');
  });

  it('returns the non-blank target line index for note line movement', () => {
    expect(getNoteLineMovementTargetIndex('A\n\nB', 2, 'up')).toBe(0);
    expect(getNoteLineMovementTargetIndex('A\n\nB', 0, 'down')).toBe(2);
    expect(getNoteLineMovementTargetIndex('A\n\nB', 1, 'down')).toBe(-1);
  });

  it('leaves blank note lines unchanged when they are selected', () => {
    expect(moveNoteLine('A\n\nB', 1, 'down')).toBe('A\n\nB');
  });

  it('moves indented list items without changing indentation', () => {
    expect(moveNoteLine('- 親A\n  - 子A1\n- 親B', 2, 'up')).toBe('- 親A\n- 親B\n  - 子A1');
    expect(moveNoteLine('- 親A\n  - 子A1', 1, 'up')).toBe('  - 子A1\n- 親A');
  });
});

function note(id: string, markdown: string, updatedAt = '2026-05-01T00:00:00.000Z'): Note {
  return { id, markdown, updatedAt };
}
