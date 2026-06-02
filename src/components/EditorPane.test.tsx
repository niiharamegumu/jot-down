import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorPane } from './EditorPane';

const mockSetMarkdown = vi.fn();
const mockInsertMarkdown = vi.fn();
const mockGetMarkdown = vi.fn();
const mockFocus = vi.fn((callback?: () => void) => callback?.());
let mockSetMarkdownSideEffect: ((markdown: string) => string | void) | null = null;

vi.mock('@mdxeditor/editor', async () => {
  const React = await import('react');

  return {
    createRootEditorSubscription$: Symbol('createRootEditorSubscription$'),
    headingsPlugin: vi.fn(),
    linkDialogPlugin: vi.fn(),
    linkPlugin: vi.fn(),
    listsPlugin: vi.fn(),
    markdownShortcutPlugin: vi.fn(),
    realmPlugin: vi.fn((plugin) => () => plugin),
    MDXEditor: React.forwardRef(function MockMDXEditor(
      { markdown, onChange }: { markdown: string; onChange: (markdown: string) => void },
      ref
    ) {
      React.useImperativeHandle(ref, () => ({
        getMarkdown: mockGetMarkdown,
        setMarkdown: (nextMarkdown: string) => {
          mockSetMarkdown(nextMarkdown);
          const exportedMarkdown = mockSetMarkdownSideEffect?.(nextMarkdown);
          if (typeof exportedMarkdown === 'string') {
            onChange(exportedMarkdown);
          }
        },
        insertMarkdown: mockInsertMarkdown,
        focus: mockFocus
      }));

      return (
        <div
          aria-label="Markdown editor"
          contentEditable
          onBlur={() => undefined}
          onInput={(event) => onChange(event.currentTarget.textContent ?? '')}
          suppressContentEditableWarning
        >
          {markdown.split('\n').map((line, index) => {
            if (line === '') {
              return null;
            }

            const task = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/);

            if (!task) {
              const listItem = line.match(/^\s*[-*]\s+(.+)$/);
              if (listItem) {
                return <li key={`${line}-${index}`}>{listItem[1]}</li>;
              }

              return <p key={`${line}-${index}`}>{line}</p>;
            }

            return (
              <li
                key={`${line}-${index}`}
                role="checkbox"
                aria-checked={task[1].toLowerCase() === 'x'}
              >
                {task[2]}
              </li>
            );
          })}
        </div>
      );
    })
  };
});

const note = {
  id: 'note-1',
  markdown: '- [ ] 買い物\n- [x] メール返信',
  updatedAt: '2026-05-27T03:15:00.000Z'
};

afterEach(() => {
  mockSetMarkdownSideEffect = null;
  mockSetMarkdown.mockClear();
  mockInsertMarkdown.mockClear();
  mockGetMarkdown.mockReset();
  mockFocus.mockClear();
  vi.restoreAllMocks();
});

describe('EditorPane', () => {
  it('shows local note store preparation while no note is selected', () => {
    render(
      <EditorPane
        note={null}
        markdown=""
        updatedAt={null}
        applicableTemplates={[]}
        storageError={null}
        appUpdateAvailable={false}
        isApplyingAppUpdate={false}
        onMarkdownChange={vi.fn()}
        onFlush={vi.fn()}
        onApplyAppUpdate={vi.fn()}
        onDuplicateNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onOpenTemplateManagement={vi.fn()}
        onBackToList={vi.fn()}
      />
    );

    expect(screen.getByText('Local note storeを準備しています。')).toBeInTheDocument();
  });

  it('surfaces save failures without hiding the active note', () => {
    renderEditor({ storageError: 'IndexedDBを開けません。' });

    expect(screen.getByRole('alert')).toHaveTextContent('保存できません。');
    expect(screen.getByRole('alert')).toHaveTextContent('IndexedDBを開けません。');
    expect(screen.getByText('買い物')).toBeInTheDocument();
  });

  it('applies an app update only when the user chooses the update action', async () => {
    const user = userEvent.setup();
    const onApplyAppUpdate = vi.fn();

    renderEditor({ appUpdateAvailable: true, onApplyAppUpdate });

    await user.click(screen.getByRole('button', { name: '更新' }));

    expect(onApplyAppUpdate).toHaveBeenCalledTimes(1);
  });

  it('toggles a clicked task checkbox in the note Markdown', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange });

    const firstTask = screen.getAllByRole('checkbox')[0];
    fireEvent.click(firstTask, { clientX: 1 });

    expect(onMarkdownChange).toHaveBeenCalledWith('- [x] 買い物\n- [x] メール返信');
  });

  it('does not toggle when clicking task text outside the checkbox marker', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange });

    const firstTask = screen.getAllByRole('checkbox')[0];
    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 80
    });
    firstTask.dispatchEvent(mouseDown);
    fireEvent.click(firstTask, { clientX: 80, clientY: 12 });

    expect(mouseDown.defaultPrevented).toBe(false);
    expect(onMarkdownChange).not.toHaveBeenCalled();
  });

  it('toggles the selected task with command enter', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange });

    selectText(screen.getByText('メール返信').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'Enter',
      metaKey: true
    });

    expect(onMarkdownChange).toHaveBeenCalledWith('- [ ] 買い物\n- [ ] メール返信');
  });

  it('keeps the cursor on the selected task after command enter', () => {
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return 1;
    });

    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange });
    animationFrameCallbacks.at(-1)?.(0);
    animationFrameCallbacks.length = 0;

    const firstTaskText = screen.getByText('買い物').firstChild;
    const secondTask = screen.getByText('メール返信');
    const secondTaskText = secondTask.firstChild;
    selectText(secondTaskText);

    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'Enter',
      metaKey: true
    });
    selectText(firstTaskText);

    expect(onMarkdownChange).toHaveBeenCalledWith('- [ ] 買い物\n- [ ] メール返信');
    expect(animationFrameCallbacks).toHaveLength(1);
    const restoreCursor = animationFrameCallbacks.at(-1);
    if (!restoreCursor) {
      throw new Error('Expected cursor restoration to be scheduled');
    }

    restoreCursor?.(0);

    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    expect(range?.startContainer).toBe(secondTaskText);
    expect(range?.startOffset).toBe(0);
  });

  it('keeps the scroll position after command enter', () => {
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return 1;
    });

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

    try {
      renderEditor();
      animationFrameCallbacks.at(-1)?.(0);
      animationFrameCallbacks.length = 0;

      selectText(screen.getByText('メール返信').firstChild);
      fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
        key: 'Enter',
        metaKey: true
      });

      scrollingElement.scrollTop = 0;
      scrollingElement.scrollLeft = 0;
      animationFrameCallbacks.at(-1)?.(0);

      expect(scrollingElement.scrollTop).toBe(420);
      expect(scrollingElement.scrollLeft).toBe(12);
    } finally {
      if (originalScrollingElementDescriptor) {
        Object.defineProperty(document, 'scrollingElement', originalScrollingElementDescriptor);
      } else {
        Reflect.deleteProperty(document, 'scrollingElement');
      }
    }
  });

  it('does not restore the cursor after switching notes', () => {
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return 1;
    });

    const { rerender } = renderEditor();
    animationFrameCallbacks.at(-1)?.(0);
    animationFrameCallbacks.length = 0;

    selectText(screen.getByText('メール返信').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'Enter',
      metaKey: true
    });

    const staleRestoreCursor = animationFrameCallbacks.at(-1);
    if (!staleRestoreCursor) {
      throw new Error('Expected cursor restoration to be scheduled');
    }

    const nextNote = {
      ...note,
      id: 'note-2',
      markdown: '- [ ] 別のNote\n- [ ] 別タスク'
    };
    rerender(
      <EditorPane
        note={nextNote}
        markdown={nextNote.markdown}
        updatedAt={nextNote.updatedAt}
        applicableTemplates={[]}
        storageError={null}
        appUpdateAvailable={false}
        isApplyingAppUpdate={false}
        onMarkdownChange={vi.fn()}
        onFlush={vi.fn()}
        onApplyAppUpdate={vi.fn()}
        onDuplicateNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onOpenTemplateManagement={vi.fn()}
        onBackToList={vi.fn()}
      />
    );

    const nextNoteText = screen.getByText('別のNote').firstChild;
    const otherTaskText = screen.getByText('別タスク').firstChild;
    selectText(nextNoteText);

    staleRestoreCursor(0);

    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    expect(range?.startContainer).toBe(nextNoteText);
    expect(range?.startContainer).not.toBe(otherTaskText);
  });

  it('ignores command enter when the selected line is not a task', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange, markdown: '本文\n- [ ] 買い物' });

    selectText(screen.getByText('本文').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'Enter',
      metaKey: true
    });

    expect(onMarkdownChange).not.toHaveBeenCalled();
  });

  it('does not reset the editor while typing into a regular unchecked task', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange, markdown: '- [ ] a' });

    mockSetMarkdown.mockClear();

    const editor = screen.getByLabelText('Markdown editor');
    editor.textContent = '- [ ] aa';
    fireEvent.input(editor);

    expect(mockSetMarkdown).not.toHaveBeenCalled();
    expect(onMarkdownChange).toHaveBeenCalledWith('- [ ] aa');
  });

  it('moves the selected note line up with option arrow up', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange, markdown: '- [ ] 買い物\n- [x] メール返信\n本文' });

    selectText(screen.getByText('メール返信').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowUp',
      altKey: true
    });

    expect(onMarkdownChange).toHaveBeenCalledWith('- [x] メール返信\n- [ ] 買い物\n本文');
  });

  it('moves a task note line that contains bracketed text', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange, markdown: '- [ ] xxx\n- [ ] [test]テスト\n本文' });

    selectText(screen.getByText('[test]テスト').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowUp',
      altKey: true
    });

    expect(onMarkdownChange).toHaveBeenCalledWith('- [ ] [test]テスト\n- [ ] xxx\n本文');
  });

  it('does not move the selected note line with command option arrow up', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange, markdown: '- [ ] 買い物\n- [x] メール返信\n本文' });

    selectText(screen.getByText('メール返信').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowUp',
      altKey: true,
      metaKey: true
    });

    expect(onMarkdownChange).not.toHaveBeenCalled();
  });

  it('moves the selected note line down with option arrow down', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange, markdown: '- [ ] 買い物\n本文\n- [x] メール返信' });

    selectText(screen.getByText('本文').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowDown',
      altKey: true
    });

    expect(onMarkdownChange).toHaveBeenCalledWith('- [ ] 買い物\n- [x] メール返信\n本文');
  });

  it('moves the selected note line after an omitted blank editor line', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({
      onMarkdownChange,
      markdown: '# 見出しA\n- [ ] A1\n\n# 見出しB\n- [ ] B1\n- [ ] B2'
    });

    selectText(screen.getByText('B2').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowUp',
      altKey: true
    });

    expect(onMarkdownChange).toHaveBeenCalledWith(
      '# 見出しA\n- [ ] A1\n\n# 見出しB\n- [ ] B2\n- [ ] B1'
    );
  });

  it('skips omitted blank editor lines when moving a note line', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange, markdown: 'A\n\nB' });

    selectText(screen.getByText('B').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowUp',
      altKey: true
    });

    expect(onMarkdownChange).toHaveBeenCalledWith('B\n\nA');
  });

  it('does not accept editor checklist normalization after moving a plain list item', () => {
    const onMarkdownChange = vi.fn();
    mockSetMarkdownSideEffect = () => '- [ ] xxx\n- [ ] bbb\n- [ ] aaa';
    renderEditor({ onMarkdownChange, markdown: '- [ ] xxx\n\n- aaa\n- bbb' });
    onMarkdownChange.mockClear();

    selectText(screen.getByText('aaa').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowDown',
      altKey: true
    });

    expect(onMarkdownChange).toHaveBeenCalledWith('- [ ] xxx\n\n- bbb\n- aaa');
    expect(onMarkdownChange).not.toHaveBeenCalledWith('- [ ] xxx\n- [ ] bbb\n- [ ] aaa');
  });

  it('ignores delayed checklist normalization after moving a plain list item', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange, markdown: '- [ ] xxx\n\n- aaa\n- bbb' });

    selectText(screen.getByText('aaa').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowDown',
      altKey: true
    });
    onMarkdownChange.mockClear();
    mockGetMarkdown.mockReturnValue('- [ ] xxx\n- [ ] bbb\n- [ ] aaa');

    fireEvent.blur(screen.getByLabelText('Markdown editor'));

    expect(onMarkdownChange).not.toHaveBeenCalled();
  });

  it('keeps the moved Markdown line unchanged when the editor exports a normalized list', () => {
    const onMarkdownChange = vi.fn();
    mockSetMarkdownSideEffect = () => '- [ ] 子A1\n- [ ] 親A\n- [ ] 親B';
    renderEditor({
      onMarkdownChange,
      markdown: '- [ ] 親A\n  - [ ] 子A1\n- [ ] 親B'
    });
    onMarkdownChange.mockClear();

    selectText(screen.getByText('子A1').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowUp',
      altKey: true
    });

    expect(onMarkdownChange).toHaveBeenCalledWith('  - [ ] 子A1\n- [ ] 親A\n- [ ] 親B');
    expect(onMarkdownChange).not.toHaveBeenCalledWith('- [ ] 子A1\n- [ ] 親A\n- [ ] 親B');
  });

  it('keeps the moved Markdown line unchanged when blur sync reads a normalized list', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({
      onMarkdownChange,
      markdown: '- [ ] 親A\n  - [ ] 子A1\n- [ ] 親B'
    });

    selectText(screen.getByText('子A1').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowUp',
      altKey: true
    });
    onMarkdownChange.mockClear();
    mockGetMarkdown.mockReturnValue('- [ ] 子A1\n- [ ] 親A\n- [ ] 親B');

    fireEvent.blur(screen.getByLabelText('Markdown editor'));

    expect(onMarkdownChange).not.toHaveBeenCalled();
  });

  it('does not change note Markdown when a note line cannot move past the boundary', () => {
    const onMarkdownChange = vi.fn();
    renderEditor({ onMarkdownChange, markdown: '先頭\n本文' });

    selectText(screen.getByText('先頭').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowUp',
      altKey: true
    });

    expect(onMarkdownChange).not.toHaveBeenCalled();
  });

  it('keeps the cursor on the moved note line after option arrow movement', () => {
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return 1;
    });

    renderControlledEditor('- [ ] 買い物\n- [x] メール返信\n本文');
    animationFrameCallbacks.at(-1)?.(0);
    animationFrameCallbacks.length = 0;

    selectText(screen.getByText('メール返信').firstChild);
    fireEvent.keyDown(screen.getByLabelText('Markdown editor'), {
      key: 'ArrowUp',
      altKey: true
    });

    expect(screen.getAllByRole('checkbox')[0]).toHaveTextContent('メール返信');
    const restoreCursor = animationFrameCallbacks.at(-1);
    if (!restoreCursor) {
      throw new Error('Expected cursor restoration to be scheduled');
    }

    restoreCursor(0);

    const movedTaskText = screen.getByText('メール返信').firstChild;
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    expect(range?.startContainer).toBe(movedTaskText);
    expect(range?.startOffset).toBe(0);
  });

  it('inserts pasted Markdown through the Markdown editor import path', () => {
    const onMarkdownChange = vi.fn();
    mockGetMarkdown.mockReturnValue('# 今日やること\n- [ ] 買い物');
    renderEditor({ onMarkdownChange, markdown: '' });
    mockSetMarkdown.mockClear();
    mockInsertMarkdown.mockClear();

    fireEvent.paste(
      screen.getByLabelText('Markdown editor'),
      createPasteEventProperties('# 今日やること\n- [ ] 買い物')
    );

    expect(mockSetMarkdown).toHaveBeenCalledWith('# 今日やること\n- [ ] 買い物');
    expect(mockInsertMarkdown).not.toHaveBeenCalled();
    expect(onMarkdownChange).toHaveBeenCalledWith('# 今日やること\n- [ ] 買い物');
  });

  it('keeps pasted Markdown unchanged when the editor exports a normalized checklist', () => {
    const onMarkdownChange = vi.fn();
    mockSetMarkdownSideEffect = () => '- [ ] xxx\n- [ ] aaa\n- [ ] bbb';
    renderEditor({ onMarkdownChange, markdown: '' });
    onMarkdownChange.mockClear();

    fireEvent.paste(
      screen.getByLabelText('Markdown editor'),
      createPasteEventProperties('- [ ] xxx\n\n- aaa\n- bbb')
    );

    expect(onMarkdownChange).toHaveBeenCalledWith('- [ ] xxx\n\n- aaa\n- bbb');
    expect(onMarkdownChange).not.toHaveBeenCalledWith('- [ ] xxx\n- [ ] aaa\n- [ ] bbb');
  });

  it('replaces the whole note on full-selection paste without editor insertion normalization', () => {
    const onMarkdownChange = vi.fn();
    mockSetMarkdownSideEffect = () => '- [ ] xxx\n- [ ] aaa\n- [ ] bbb';
    renderEditor({ onMarkdownChange, markdown: '- [ ] old\n- [ ] other' });
    onMarkdownChange.mockClear();

    selectContents(screen.getByLabelText('Markdown editor'));
    fireEvent.paste(
      screen.getByLabelText('Markdown editor'),
      createPasteEventProperties('- [ ] xxx\n\n- aaa\n- bbb')
    );

    expect(mockInsertMarkdown).not.toHaveBeenCalled();
    expect(onMarkdownChange).toHaveBeenCalledWith('- [ ] xxx\n\n- aaa\n- bbb');
    expect(onMarkdownChange).not.toHaveBeenCalledWith('- [ ] xxx\n- [ ] aaa\n- [ ] bbb');
  });

  it('reimports pasted plain URLs as Markdown links so they become clickable', () => {
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return 1;
    });
    const onMarkdownChange = vi.fn();
    mockGetMarkdown.mockReturnValue('参考https://example.com/specを見る');
    renderEditor({ onMarkdownChange });
    animationFrameCallbacks.at(-1)?.(0);
    animationFrameCallbacks.length = 0;
    mockSetMarkdown.mockClear();

    fireEvent.paste(screen.getByLabelText('Markdown editor'), createPasteEventProperties(''));
    animationFrameCallbacks.at(-1)?.(0);

    const normalizedMarkdown = '参考[https://example.com/spec](https://example.com/spec)を見る';
    expect(mockSetMarkdown).toHaveBeenCalledWith(normalizedMarkdown);
    expect(onMarkdownChange).toHaveBeenCalledWith(normalizedMarkdown);
  });

  it('flushes note changes when editing focus leaves the editor', () => {
    const onFlush = vi.fn();
    renderEditor({ onFlush });

    fireEvent.blur(screen.getByLabelText('Markdown editor'));

    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('keeps the editor state while focus moves to the link dialog', () => {
    const onFlush = vi.fn();
    renderEditor({ onFlush });
    mockSetMarkdown.mockClear();

    const linkDialog = document.createElement('div');
    linkDialog.setAttribute('role', 'dialog');
    linkDialog.className = '_linkDialogPopoverContent_test';
    const editLinkButton = document.createElement('button');
    editLinkButton.setAttribute('aria-label', 'Edit link URL');
    linkDialog.append(editLinkButton);
    document.body.append(linkDialog);

    try {
      fireEvent.blur(screen.getByLabelText('Markdown editor'), { relatedTarget: editLinkButton });

      expect(mockSetMarkdown).not.toHaveBeenCalled();
      expect(onFlush).not.toHaveBeenCalled();
    } finally {
      linkDialog.remove();
    }
  });

  it('confirms deletion through the delete action', async () => {
    const user = userEvent.setup();
    const onDeleteNote = vi.fn();
    renderEditor({ onDeleteNote });

    await user.click(screen.getByRole('button', { name: 'Noteを削除' }));

    expect(onDeleteNote).toHaveBeenCalledTimes(1);
  });

  it('requests note duplication through the duplicate action', async () => {
    const user = userEvent.setup();
    const onDuplicateNote = vi.fn();
    renderEditor({ onDuplicateNote });

    await user.click(screen.getByRole('button', { name: 'Noteを複製' }));

    expect(onDuplicateNote).toHaveBeenCalledTimes(1);
  });

  it('copies the visible note Markdown to the clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const restoreClipboard = mockClipboard(writeText);

    try {
      renderEditor({ markdown: '# 見出し\n- [ ] タスク' });

      await user.click(screen.getByRole('button', { name: 'Note Markdownをコピー' }));

      expect(writeText).toHaveBeenCalledWith('# 見出し\n- [ ] タスク');
      expect(await screen.findByText('コピーしました')).toBeInTheDocument();
    } finally {
      restoreClipboard();
    }
  });

  it('falls back to selection copy when clipboard writing fails', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    const restoreClipboard = mockClipboard(writeText);
    const { execCommand, restoreExecCommand } = mockExecCommand(true);

    try {
      renderEditor({ markdown: '# フォールバック' });

      await user.click(screen.getByRole('button', { name: 'Note Markdownをコピー' }));

      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(await screen.findByText('コピーしました')).toBeInTheDocument();
    } finally {
      restoreClipboard();
      restoreExecCommand();
    }
  });

  it('shows a failure message when all note Markdown copy methods fail', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    const restoreClipboard = mockClipboard(writeText);
    const { restoreExecCommand } = mockExecCommand(false);

    try {
      renderEditor();

      await user.click(screen.getByRole('button', { name: 'Note Markdownをコピー' }));

      expect(await screen.findByText('コピーできませんでした')).toBeInTheDocument();
    } finally {
      restoreClipboard();
      restoreExecCommand();
    }
  });

  it('inserts a selected template into the note Markdown', async () => {
    const user = userEvent.setup();
    const onMarkdownChange = vi.fn();
    mockGetMarkdown.mockReturnValue('- [ ] 買い物\n# 会議');

    renderEditor({
      onMarkdownChange,
      applicableTemplates: [
        {
          id: 'template-1',
          name: '会議',
          markdown: '# 会議',
          updatedAt: '2026-05-27T03:15:00.000Z'
        }
      ]
    });

    await user.click(screen.getByRole('button', { name: 'テンプレートを挿入' }));
    await user.click(screen.getByRole('button', { name: '会議' }));

    expect(mockFocus).toHaveBeenCalled();
    expect(mockInsertMarkdown).toHaveBeenCalledWith('# 会議');
    expect(onMarkdownChange).toHaveBeenCalledWith('- [ ] 買い物\n# 会議');
  });

  it('lists editor shortcuts in the toolbar help', () => {
    renderEditor();

    expect(screen.getByRole('button', { name: 'ショートカット一覧' })).toBeInTheDocument();
    expect(screen.getByText('⌘ + Enter')).toBeInTheDocument();
    expect(screen.getByText('タスクのチェックを切り替え')).toBeInTheDocument();
    expect(screen.getByText('⌥ + ↑')).toBeInTheDocument();
    expect(screen.getByText('行を上へ移動')).toBeInTheDocument();
    expect(screen.getByText('⌥ + ↓')).toBeInTheDocument();
    expect(screen.getByText('行を下へ移動')).toBeInTheDocument();
  });
});

function renderEditor(
  props: Partial<React.ComponentProps<typeof EditorPane>> = {}
): ReturnType<typeof render> {
  return render(
    <EditorPane
      note={note}
      markdown={note.markdown}
      updatedAt={note.updatedAt}
      applicableTemplates={[]}
      storageError={null}
      appUpdateAvailable={false}
      isApplyingAppUpdate={false}
      onMarkdownChange={vi.fn()}
      onFlush={vi.fn()}
      onApplyAppUpdate={vi.fn()}
      onDuplicateNote={vi.fn()}
      onDeleteNote={vi.fn()}
      onOpenTemplateManagement={vi.fn()}
      onBackToList={vi.fn()}
      {...props}
    />
  );
}

function renderControlledEditor(initialMarkdown: string): ReturnType<typeof render> {
  function ControlledEditor() {
    const [markdown, setMarkdown] = useState(initialMarkdown);

    return (
      <EditorPane
        note={{ ...note, markdown }}
        markdown={markdown}
        updatedAt={note.updatedAt}
        applicableTemplates={[]}
        storageError={null}
        appUpdateAvailable={false}
        isApplyingAppUpdate={false}
        onMarkdownChange={setMarkdown}
        onFlush={vi.fn()}
        onApplyAppUpdate={vi.fn()}
        onDuplicateNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onOpenTemplateManagement={vi.fn()}
        onBackToList={vi.fn()}
      />
    );
  }

  return render(<ControlledEditor />);
}

function selectText(node: ChildNode | null) {
  if (!node) {
    throw new Error('Expected selectable text node');
  }

  selectContents(node);
}

function selectContents(node: Node | null) {
  if (!node) {
    throw new Error('Expected selectable node');
  }

  const range = document.createRange();
  range.selectNodeContents(node);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function mockClipboard(writeText: (value: string) => Promise<void>) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText }
  });

  return () => {
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  };
}

function mockExecCommand(result: boolean) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');
  const execCommand = vi.fn().mockReturnValue(result);
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: execCommand
  });

  return {
    execCommand,
    restoreExecCommand: () => {
      if (originalDescriptor) {
        Object.defineProperty(document, 'execCommand', originalDescriptor);
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }
  };
}

function createPasteEventProperties(text: string) {
  return {
    clipboardData: {
      getData: (type: string) => (type === 'text/plain' ? text : '')
    }
  };
}
