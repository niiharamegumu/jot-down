import { describe, expect, it } from 'vitest';
import { getSelectedNoteLineIndex } from './editorLineSelection';

describe('editor line selection', () => {
  it('ignores nested list wrapper elements when mapping editor lines to Markdown lines', () => {
    const root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    root.innerHTML = `
      <ul>
        <li><span data-lexical-text="true">親A</span></li>
        <li><ul><li><span data-lexical-text="true">子A1</span></li></ul></li>
        <li><span data-lexical-text="true">親B</span></li>
      </ul>
    `;
    document.body.append(root);

    try {
      const childText = root.querySelectorAll('li span[data-lexical-text="true"]')[1]?.firstChild;
      selectText(childText);

      expect(getSelectedNoteLineIndex(root, '- 親A\n  - 子A1\n- 親B')).toBe(1);
    } finally {
      root.remove();
    }
  });

  it('maps editor lines to Markdown lines by position instead of rendered text', () => {
    const root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    root.innerHTML = `
      <ul>
        <li role="checkbox"><span data-lexical-text="true">xxx</span></li>
        <li role="checkbox"><span data-lexical-text="true">testテスト</span></li>
      </ul>
    `;
    document.body.append(root);

    try {
      const bracketedText = root.querySelectorAll('li span[data-lexical-text="true"]')[1]
        ?.firstChild;
      selectText(bracketedText);

      expect(getSelectedNoteLineIndex(root, '- [ ] xxx\n- [ ] [test]テスト')).toBe(1);
    } finally {
      root.remove();
    }
  });
});

function selectText(node: ChildNode | null | undefined) {
  if (!node) {
    throw new Error('Expected selectable text node');
  }

  const range = document.createRange();
  range.selectNodeContents(node);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
