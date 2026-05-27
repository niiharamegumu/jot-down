import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditorPane } from './EditorPane';

const mockSetMarkdown = vi.fn();

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
        setMarkdown: mockSetMarkdown
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

describe('EditorPane', () => {
  it('shows local note store preparation while no note is selected', () => {
    render(
      <EditorPane
        note={null}
        markdown=""
        updatedAt={null}
        storageError={null}
        appUpdateAvailable={false}
        isApplyingAppUpdate={false}
        onMarkdownChange={vi.fn()}
        onFlush={vi.fn()}
        onApplyAppUpdate={vi.fn()}
        onDeleteNote={vi.fn()}
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
});

function renderEditor(
  props: Partial<React.ComponentProps<typeof EditorPane>> = {}
): ReturnType<typeof render> {
  return render(
    <EditorPane
      note={note}
      markdown={note.markdown}
      updatedAt={note.updatedAt}
      storageError={null}
      appUpdateAvailable={false}
      isApplyingAppUpdate={false}
      onMarkdownChange={vi.fn()}
      onFlush={vi.fn()}
      onApplyAppUpdate={vi.fn()}
      onDeleteNote={vi.fn()}
      onBackToList={vi.fn()}
      {...props}
    />
  );
}
