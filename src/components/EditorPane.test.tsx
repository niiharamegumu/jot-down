import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorPane } from './EditorPane';

const mockSetMarkdown = vi.fn();
const mockInsertMarkdown = vi.fn();
const mockGetMarkdown = vi.fn();
const mockFocus = vi.fn((callback?: () => void) => callback?.());

vi.mock('@mdxeditor/editor', async () => {
  const React = await import('react');

  return {
    headingsPlugin: vi.fn(),
    linkDialogPlugin: vi.fn(),
    linkPlugin: vi.fn(),
    listsPlugin: vi.fn(),
    markdownShortcutPlugin: vi.fn(),
    MDXEditor: React.forwardRef(function MockMDXEditor(
      { markdown, onChange }: { markdown: string; onChange: (markdown: string) => void },
      ref
    ) {
      React.useImperativeHandle(ref, () => ({
        getMarkdown: mockGetMarkdown,
        setMarkdown: mockSetMarkdown,
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
            const task = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/);

            if (!task) {
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
      markdown: '- [ ] 別のNote'
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
        onDeleteNote={vi.fn()}
        onOpenTemplateManagement={vi.fn()}
        onBackToList={vi.fn()}
      />
    );

    const nextNoteText = screen.getByText('別のNote').firstChild;
    selectText(nextNoteText);

    staleRestoreCursor(0);

    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    expect(range?.startContainer).toBe(nextNoteText);
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

  it('flushes note changes when editing focus leaves the editor', () => {
    const onFlush = vi.fn();
    renderEditor({ onFlush });

    fireEvent.blur(screen.getByLabelText('Markdown editor'));

    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('confirms deletion through the delete action', async () => {
    const user = userEvent.setup();
    const onDeleteNote = vi.fn();
    renderEditor({ onDeleteNote });

    await user.click(screen.getByRole('button', { name: 'Noteを削除' }));

    expect(onDeleteNote).toHaveBeenCalledTimes(1);
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
      onDeleteNote={vi.fn()}
      onOpenTemplateManagement={vi.fn()}
      onBackToList={vi.fn()}
      {...props}
    />
  );
}

function selectText(node: ChildNode | null) {
  if (!node) {
    throw new Error('Expected selectable text node');
  }

  const range = document.createRange();
  range.selectNodeContents(node);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
