import { describe, expect, it } from 'vitest';
import {
  getNoteFolderNameKey,
  isUniqueNoteFolderName,
  isValidNoteFolderName,
  normalizeNoteFolderName,
  sortNoteFoldersByName,
  type NoteFolder
} from './noteFolder';

describe('Note folder name', () => {
  it('uses trimmed non-empty names', () => {
    expect(normalizeNoteFolderName('  仕事  ')).toBe('仕事');
    expect(isValidNoteFolderName('   ')).toBe(false);
  });

  it('checks uniqueness without letter case but keeps width differences distinct', () => {
    const folders: NoteFolder[] = [{ id: 'work', name: 'Work' }];

    expect(isUniqueNoteFolderName('work', folders)).toBe(false);
    expect(isUniqueNoteFolderName('Ｗｏｒｋ', folders)).toBe(true);
    expect(getNoteFolderNameKey(' WORK ')).toBe('work');
  });
});

describe('Note folder order', () => {
  it('sorts folder names with case-insensitive Japanese locale ordering', () => {
    const folders: NoteFolder[] = [
      { id: 'b', name: 'beta' },
      { id: 'a', name: 'Alpha' },
      { id: 'j', name: '家事' }
    ];

    expect(sortNoteFoldersByName(folders).map((folder) => folder.id)).toEqual(['a', 'b', 'j']);
    expect(folders.map((folder) => folder.id)).toEqual(['b', 'a', 'j']);
  });
});
