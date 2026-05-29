import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureTaskSelectionSnapshot, restoreTaskSelectionSnapshot } from './editorTaskSelection';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('editor task selection', () => {
  it('restores delayed scroll only while the same note is active', () => {
    const scrollingElement = document.createElement('div');
    scrollingElement.scrollTop = 420;
    const originalScrollingElementDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'scrollingElement'
    );
    Object.defineProperty(document, 'scrollingElement', {
      configurable: true,
      get: () => scrollingElement
    });

    try {
      const checkbox = document.createElement('li');
      checkbox.setAttribute('role', 'checkbox');
      checkbox.textContent = 'メール返信';
      document.body.append(checkbox);

      const snapshot = captureTaskSelectionSnapshot('note-1', 0, checkbox);
      const animationFrameCallbacks: FrameRequestCallback[] = [];
      let currentNoteId: string | null = 'note-1';

      scrollingElement.scrollTop = 0;
      restoreTaskSelectionSnapshot(
        snapshot,
        () => currentNoteId,
        checkbox,
        (callback) => {
          animationFrameCallbacks.push(callback);
          return 1;
        }
      );
      expect(scrollingElement.scrollTop).toBe(420);

      scrollingElement.scrollTop = 0;
      currentNoteId = 'note-2';
      animationFrameCallbacks.at(-1)?.(0);
      expect(scrollingElement.scrollTop).toBe(0);
    } finally {
      if (originalScrollingElementDescriptor) {
        Object.defineProperty(document, 'scrollingElement', originalScrollingElementDescriptor);
      } else {
        Reflect.deleteProperty(document, 'scrollingElement');
      }
    }
  });
});
