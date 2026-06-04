import { describe, expect, it } from 'vitest';
import {
  addEditorOnlyListBoundaries,
  removeEditorOnlyListBoundaries
} from './editorMarkdownBoundaries';

describe('editor Markdown boundaries', () => {
  it('adds an editor-only boundary between task and plain list blocks', () => {
    expect(addEditorOnlyListBoundaries('- [ ] aaa\n- [ ] bbb\n\n- ccc\n- ddd')).toBe(
      '- [ ] aaa\n- [ ] bbb\n\n<!-- jot-down:list-boundary -->\n- ccc\n- ddd'
    );
  });

  it('adds an editor-only boundary between plain and task list blocks', () => {
    expect(addEditorOnlyListBoundaries('- ccc\n- ddd\n\n- [ ] xxx')).toBe(
      '- ccc\n- ddd\n\n<!-- jot-down:list-boundary -->\n- [ ] xxx'
    );
  });

  it('adds an editor-only boundary between adjacent plain and task list items', () => {
    expect(addEditorOnlyListBoundaries('- ccc\n- [ ] xxx')).toBe(
      '- ccc\n<!-- jot-down:list-boundary -->\n- [ ] xxx'
    );
  });

  it('adds an editor-only boundary after a list before a separate paragraph', () => {
    expect(addEditorOnlyListBoundaries('- ccc\nUseful link\n- [ ] xxx')).toBe(
      '- ccc\n<!-- jot-down:list-boundary -->\nUseful link\n- [ ] xxx'
    );
  });

  it('keeps indented list continuation lines attached to their list item', () => {
    expect(addEditorOnlyListBoundaries('- ccc\n  Useful link\n- [ ] xxx')).toBe(
      '- ccc\n  Useful link\n<!-- jot-down:list-boundary -->\n- [ ] xxx'
    );
  });

  it('removes editor-only boundaries before saving app Markdown', () => {
    expect(
      removeEditorOnlyListBoundaries('- [ ] aaa\n\n<!-- jot-down:list-boundary -->\n- ccc')
    ).toBe('- [ ] aaa\n\n- ccc');
  });
});
