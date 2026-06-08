import { describe, expect, it } from 'vitest';
import {
  deriveNoteSnippet,
  deriveNoteTitle,
  duplicateNote,
  getNoteLineMovementTargetIndex,
  getNoteLineMovementTargetRange,
  matchesNoteSearch,
  moveNoteLine,
  moveNoteLines,
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
  it('creates a separate note with the same Markdown text and folder membership', () => {
    const source = {
      ...note('source', '# 買い物\n- [ ] 牛乳', '2026-05-01T00:00:00.000Z'),
      folderId: 'folder-a'
    };

    const duplicated = duplicateNote(source, 'duplicate');

    expect(duplicated).toEqual(
      expect.objectContaining({
        id: 'duplicate',
        markdown: source.markdown,
        folderId: 'folder-a'
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

  it('moves the selected note line to the start or end', () => {
    expect(moveNoteLine('A\nB\nC', 1, 'start')).toBe('B\nA\nC');
    expect(moveNoteLine('A\nB\nC', 1, 'end')).toBe('A\nC\nB');
    expect(moveNoteLine('A\nB\nC\nD', 1, 'end')).toBe('A\nC\nD\nB');
  });

  it('leaves note text unchanged at movement boundaries', () => {
    expect(moveNoteLine('A\nB', 0, 'up')).toBe('A\nB');
    expect(moveNoteLine('A\nB', 1, 'down')).toBe('A\nB');
    expect(moveNoteLine('A\nB', 0, 'start')).toBe('A\nB');
    expect(moveNoteLine('A\nB', 1, 'end')).toBe('A\nB');
    expect(moveNoteLine('A\nB', 4, 'down')).toBe('A\nB');
  });

  it('carries task checked state with the moved note line', () => {
    expect(moveNoteLine('- [ ] 買い物\n- [x] メール返信', 1, 'up')).toBe(
      '- [x] メール返信\n- [ ] 買い物'
    );
  });

  it('moves the selected line past another line with the same Markdown text', () => {
    expect(moveNoteLine('- [ ] aaa\n- [ ] ccc\n- [ ] ccc\n- [ ] ddd', 1, 'down')).toBe(
      '- [ ] aaa\n- [ ] ccc\n- [ ] ccc\n- [ ] ddd'
    );
    expect(
      getNoteLineMovementTargetIndex('- [ ] aaa\n- [ ] ccc\n- [ ] ccc\n- [ ] ddd', 2, 'down')
    ).toBe(3);
  });

  it('skips blank note lines when moving non-empty note lines', () => {
    expect(moveNoteLine('A\n\nB', 2, 'up')).toBe('B\n\nA');
    expect(moveNoteLine('A\n\nB', 0, 'down')).toBe('B\n\nA');
    expect(moveNoteLine('A\n\nB\nC', 0, 'end')).toBe('B\n\nC\nA');
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

  it('moves a list item together with its indented continuation lines', () => {
    const markdown =
      '- [ ] aaa\n  [https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature](https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature)\n- [ ] bbb\n  [https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature](https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature)';

    expect(moveNoteLine(markdown, 0, 'down')).toBe(
      '- [ ] bbb\n  [https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature](https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature)\n- [ ] aaa\n  [https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature](https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature)'
    );
  });

  it('moves the containing list item when a continuation line is selected', () => {
    const markdown = '- [ ] aaa\n  https://example.com/a\n- [ ] bbb\n  https://example.com/b';

    expect(moveNoteLine(markdown, 1, 'down')).toBe(
      '- [ ] bbb\n  https://example.com/b\n- [ ] aaa\n  https://example.com/a'
    );
    expect(getNoteLineMovementTargetIndex(markdown, 1, 'down')).toBe(3);
  });

  it('moves selected note lines together as an ordered group', () => {
    expect(moveNoteLines('A\nB\nC\nD', { startLineIndex: 1, endLineIndex: 2 }, 'down')).toBe(
      'A\nD\nB\nC'
    );
    expect(moveNoteLines('A\nB\nC\nD', { startLineIndex: 1, endLineIndex: 2 }, 'up')).toBe(
      'B\nC\nA\nD'
    );
    expect(moveNoteLines('A\nB\nC\nD', { startLineIndex: 1, endLineIndex: 2 }, 'start')).toBe(
      'B\nC\nA\nD'
    );
    expect(moveNoteLines('A\nB\nC\nD', { startLineIndex: 1, endLineIndex: 2 }, 'end')).toBe(
      'A\nD\nB\nC'
    );
  });

  it('leaves selected note lines unchanged when the group cannot move past a boundary', () => {
    expect(moveNoteLines('A\nB\nC', { startLineIndex: 0, endLineIndex: 1 }, 'up')).toBe('A\nB\nC');
    expect(moveNoteLines('A\nB\nC', { startLineIndex: 1, endLineIndex: 2 }, 'down')).toBe(
      'A\nB\nC'
    );
  });

  it('moves only non-blank selected note lines when a selection crosses spacing', () => {
    expect(moveNoteLines('A\nB\n\nC\nD', { startLineIndex: 1, endLineIndex: 3 }, 'down')).toBe(
      'A\nD\n\nB\nC'
    );
  });

  it('expands selected continuation lines to their containing list items', () => {
    const markdown = '- [ ] aaa\n  https://example.com/a\n- [ ] bbb\n  https://example.com/b\n本文';

    expect(moveNoteLines(markdown, { startLineIndex: 1, endLineIndex: 3 }, 'down')).toBe(
      '本文\n- [ ] aaa\n  https://example.com/a\n- [ ] bbb\n  https://example.com/b'
    );
  });

  it('returns the moved selected note line range', () => {
    expect(
      getNoteLineMovementTargetRange('A\nB\nC\nD', { startLineIndex: 1, endLineIndex: 2 }, 'down')
    ).toEqual({ startLineIndex: 2, endLineIndex: 3 });
  });
});

function note(id: string, markdown: string, updatedAt = '2026-05-01T00:00:00.000Z'): Note {
  return { id, markdown, updatedAt };
}
