import type { MDXEditorMethods } from '@mdxeditor/editor';
import { describe, expect, it, vi } from 'vitest';
import { syncNormalizedEditorMarkdown } from './editorMarkdownSync';

describe('syncNormalizedEditorMarkdown', () => {
  it('keeps the cursor after the pasted URL text when Markdown is reimported', () => {
    const editorRoot = document.createElement('div');
    editorRoot.contentEditable = 'true';
    editorRoot.textContent = '参考https://example.com/specを見る';
    document.body.append(editorRoot);

    const cursorOffset = '参考https://example.com/spec'.length;
    placeCursor(editorRoot.firstChild, cursorOffset);

    const animationFrameCallbacks: FrameRequestCallback[] = [];
    const scheduleAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      animationFrameCallbacks.push(callback);
      return 1;
    });
    const editor = {
      getMarkdown: () => '参考https://example.com/specを見る',
      setMarkdown: vi.fn(() => {
        editorRoot.textContent = '参考https://example.com/specを見る';
        placeCursor(editorRoot.firstChild, 0);
      })
    } as unknown as MDXEditorMethods;
    const onMarkdownChange = vi.fn();

    try {
      syncNormalizedEditorMarkdown(
        editor,
        '',
        onMarkdownChange,
        editorRoot,
        scheduleAnimationFrame
      );
      animationFrameCallbacks.at(-1)?.(0);

      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      expect(range?.startContainer).toBe(editorRoot.firstChild);
      expect(range?.startOffset).toBe(cursorOffset);
      expect(onMarkdownChange).toHaveBeenCalledWith(
        '参考[https://example.com/spec](https://example.com/spec)を見る'
      );
    } finally {
      editorRoot.remove();
    }
  });

  it('restores document scroll after Markdown reimport', () => {
    const editorRoot = document.createElement('div');
    editorRoot.contentEditable = 'true';
    editorRoot.textContent = 'https://example.com/spec';
    document.body.append(editorRoot);
    placeCursor(editorRoot.firstChild, editorRoot.textContent.length);

    const scrollingElement = document.createElement('div');
    scrollingElement.scrollTop = 420;
    scrollingElement.scrollLeft = 12;
    const originalScrollingElementDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'scrollingElement'
    );
    Object.defineProperty(document, 'scrollingElement', {
      configurable: true,
      get: () => scrollingElement
    });

    const animationFrameCallbacks: FrameRequestCallback[] = [];
    const editor = {
      getMarkdown: () => 'https://example.com/spec',
      setMarkdown: vi.fn(() => {
        scrollingElement.scrollTop = 0;
        scrollingElement.scrollLeft = 0;
      })
    } as unknown as MDXEditorMethods;

    try {
      syncNormalizedEditorMarkdown(editor, '', vi.fn(), editorRoot, (callback) => {
        animationFrameCallbacks.push(callback);
        return 1;
      });

      expect(scrollingElement.scrollTop).toBe(420);
      expect(scrollingElement.scrollLeft).toBe(12);

      scrollingElement.scrollTop = 0;
      scrollingElement.scrollLeft = 0;
      animationFrameCallbacks.at(-1)?.(0);

      expect(scrollingElement.scrollTop).toBe(420);
      expect(scrollingElement.scrollLeft).toBe(12);
    } finally {
      editorRoot.remove();
      if (originalScrollingElementDescriptor) {
        Object.defineProperty(document, 'scrollingElement', originalScrollingElementDescriptor);
      } else {
        Reflect.deleteProperty(document, 'scrollingElement');
      }
    }
  });
});

function placeCursor(node: ChildNode | null, offset: number) {
  if (!node) {
    throw new Error('Expected selectable text node');
  }

  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
