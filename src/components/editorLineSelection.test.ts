import { describe, expect, it } from 'vitest';
import { getSelectedNoteLineIndex, restoreNoteLineSelectionSnapshot } from './editorLineSelection';

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
        <li><span data-lexical-text="true">ccc</span></li>
        <li><span data-lexical-text="true">ddd</span></li>
        <li role="checkbox"><span data-lexical-text="true">xxx</span></li>
      </ul>
    `;
    document.body.append(root);

    try {
      const taskText = root.querySelectorAll('li span[data-lexical-text="true"]')[2]?.firstChild;
      selectText(taskText);

      expect(getSelectedNoteLineIndex(root, '- ccc\n- ddd\n\n- [ ] xxx')).toBe(3);
    } finally {
      root.remove();
    }
  });

  it('maps list items with continuation lines to the parent Markdown list item line', () => {
    const root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    root.innerHTML = `
      <ul>
        <li role="checkbox">
          <span data-lexical-text="true">a
</span><a href="https://store.shopping.yahoo.co.jp/futureoffice/b-ab-0009.html"><span data-lexical-text="true">https://store.shopping.yahoo.co.jp/futureoffice/b-ab-0009.html</span></a>
        </li>
        <li role="checkbox">
          <span data-lexical-text="true">b
</span><a href="https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature"><span data-lexical-text="true">https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature</span></a>
        </li>
      </ul>
    `;
    document.body.append(root);

    try {
      const secondLinkText = root.querySelectorAll('a span[data-lexical-text="true"]')[1]
        ?.firstChild;
      selectText(secondLinkText);

      expect(
        getSelectedNoteLineIndex(
          root,
          '- [ ] a\n  [https://store.shopping.yahoo.co.jp/futureoffice/b-ab-0009.html](https://store.shopping.yahoo.co.jp/futureoffice/b-ab-0009.html)\n- [ ] b\n  [https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature](https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature)'
        )
      ).toBe(2);
    } finally {
      root.remove();
    }
  });

  it('restores selection to a list item represented by multiple Markdown lines', () => {
    const root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    root.innerHTML = `
      <ul>
        <li role="checkbox"><span data-lexical-text="true">b
</span><a href="https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature"><span data-lexical-text="true">https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature</span></a></li>
        <li role="checkbox"><span data-lexical-text="true">a
</span><a href="https://store.shopping.yahoo.co.jp/futureoffice/b-ab-0009.html"><span data-lexical-text="true">https://store.shopping.yahoo.co.jp/futureoffice/b-ab-0009.html</span></a></li>
      </ul>
      <p><br></p>
    `;
    document.body.append(root);

    try {
      restoreNoteLineSelectionSnapshot(
        {
          noteId: 'note-1',
          lineIndex: 2,
          markdown:
            '- [ ] b\n  [https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature](https://guide.michelin.com/jp/ja/tokyo-region/tokyo/restaurant/lature)\n- [ ] a\n  [https://store.shopping.yahoo.co.jp/futureoffice/b-ab-0009.html](https://store.shopping.yahoo.co.jp/futureoffice/b-ab-0009.html)',
          offset: 0,
          scrollPositions: []
        },
        () => 'note-1',
        root,
        () => 1
      );

      const selection = window.getSelection();
      const selectedElement = selection?.anchorNode?.parentElement?.closest('li');
      expect(selectedElement?.textContent).toContain('a');
      expect(selectedElement?.textContent).toContain('futureoffice');
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
