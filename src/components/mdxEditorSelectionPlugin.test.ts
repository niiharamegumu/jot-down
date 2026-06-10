import { describe, expect, it } from 'vitest';
import {
  getTaskTextClickSelectionRange,
  shouldHandleTaskTextMouseDown
} from './mdxEditorSelectionPlugin';

const primaryClick = {
  button: 0,
  detail: 1,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false
};

describe('mdx editor selection plugin', () => {
  it('handles a plain primary single click on task text', () => {
    expect(shouldHandleTaskTextMouseDown(primaryClick)).toBe(true);
  });

  it('handles task text double and triple clicks as text selection fallbacks', () => {
    expect(shouldHandleTaskTextMouseDown({ ...primaryClick, detail: 2 })).toBe(true);
    expect(shouldHandleTaskTextMouseDown({ ...primaryClick, detail: 3 })).toBe(true);
  });

  it('leaves modified clicks to native editor behavior', () => {
    expect(shouldHandleTaskTextMouseDown({ ...primaryClick, metaKey: true })).toBe(false);
    expect(shouldHandleTaskTextMouseDown({ ...primaryClick, shiftKey: true })).toBe(false);
    expect(shouldHandleTaskTextMouseDown({ ...primaryClick, button: 1 })).toBe(false);
  });

  it('keeps a single task text click as a caret selection', () => {
    expect(getTaskTextClickSelectionRange('メール返信', 2, 1)).toEqual({
      offset: 2,
      endOffset: 2
    });
  });

  it('selects a word for a double click task text fallback', () => {
    expect(getTaskTextClickSelectionRange('buy milk', 5, 2)).toEqual({
      offset: 4,
      endOffset: 8
    });
  });

  it('selects the task text line for a triple click task text fallback', () => {
    expect(getTaskTextClickSelectionRange('メール返信', 2, 3)).toEqual({
      offset: 0,
      endOffset: 5
    });
  });
});
