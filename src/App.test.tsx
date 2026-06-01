import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { loadNotes, loadNoteTemplates, putNote, putNoteTemplate } from './data/notesDb';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: ({ onRegisteredSW }: { onRegisteredSW: (url: string) => void }) => {
    onRegisteredSW('/sw.js');
    return {
      needRefresh: [false],
      updateServiceWorker: vi.fn()
    };
  }
}));

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
        getMarkdown: () => markdown,
        setMarkdown: vi.fn(),
        insertMarkdown: vi.fn(),
        focus: (callback?: () => void) => callback?.()
      }));

      return (
        <textarea
          aria-label="Markdown editor"
          value={markdown}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      );
    })
  };
});

vi.mock('./data/notesDb', () => ({
  loadNotes: vi.fn(),
  loadNoteTemplates: vi.fn(),
  putNote: vi.fn(),
  deleteNote: vi.fn(),
  putNoteTemplate: vi.fn(),
  deleteNoteTemplate: vi.fn()
}));

const loadNotesMock = vi.mocked(loadNotes);
const loadNoteTemplatesMock = vi.mocked(loadNoteTemplates);
const putNoteMock = vi.mocked(putNote);
const putNoteTemplateMock = vi.mocked(putNoteTemplate);

describe('App', () => {
  it('creates and shows a starter note when the local note store is empty', async () => {
    loadNotesMock.mockResolvedValue([]);
    loadNoteTemplatesMock.mockResolvedValue([]);
    putNoteMock.mockResolvedValue();

    render(<App />);

    expect(await screen.findByRole('option', { name: /今日やること/ })).toBeInTheDocument();
    expect(putNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'starter-note',
        markdown: expect.stringContaining('# 今日やること')
      })
    );
  });

  it('searches notes by Markdown text while keeping note-oriented results', async () => {
    const user = userEvent.setup();
    loadNotesMock.mockResolvedValue([
      {
        id: 'shopping',
        markdown: '# 買い物\n- [ ] 牛乳',
        updatedAt: '2026-05-27T03:15:00.000Z'
      },
      {
        id: 'ideas',
        markdown: '# アイデア\n散歩中に考える',
        updatedAt: '2026-05-26T03:15:00.000Z'
      }
    ]);
    loadNoteTemplatesMock.mockResolvedValue([]);
    putNoteMock.mockResolvedValue();

    render(<App />);

    expect(await screen.findByRole('option', { name: /買い物/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /アイデア/ })).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Noteを検索' }), '牛乳');

    expect(screen.getByRole('option', { name: /買い物/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /アイデア/ })).not.toBeInTheDocument();
  });

  it('creates a note template and then creates a note from it', async () => {
    const user = userEvent.setup();
    loadNotesMock.mockResolvedValue([
      {
        id: 'note',
        markdown: '# 既存',
        updatedAt: '2026-05-26T03:15:00.000Z'
      }
    ]);
    loadNoteTemplatesMock.mockResolvedValue([]);
    putNoteMock.mockResolvedValue();
    putNoteTemplateMock.mockResolvedValue();

    render(<App />);

    await screen.findByRole('option', { name: /既存/ });
    await user.click(screen.getByRole('button', { name: 'テンプレート管理' }));
    await user.click(screen.getByRole('button', { name: '新しいテンプレートを作成' }));
    await user.type(screen.getByRole('textbox', { name: 'テンプレート名' }), '会議');
    await user.type(screen.getByLabelText('Markdown editor'), '# 会議');

    const createFromTemplateButton = screen.getByRole('button', {
      name: 'このテンプレートでNoteを作成'
    });
    expect(createFromTemplateButton).toBeEnabled();

    await user.click(createFromTemplateButton);

    expect(await screen.findByRole('option', { name: /会議/ })).toBeInTheDocument();
    expect(putNoteMock).toHaveBeenCalledWith(expect.objectContaining({ markdown: '# 会議' }));
  });

  it('keeps list navigation collapsed across note and template views', async () => {
    const user = userEvent.setup();
    loadNotesMock.mockResolvedValue([
      {
        id: 'note',
        markdown: '# 既存',
        updatedAt: '2026-05-26T03:15:00.000Z'
      }
    ]);
    loadNoteTemplatesMock.mockResolvedValue([
      {
        id: 'template',
        name: '会議',
        markdown: '# 会議',
        updatedAt: '2026-05-28T00:00:00.000Z'
      }
    ]);
    putNoteMock.mockResolvedValue();

    const { unmount } = render(<App />);

    await screen.findByRole('option', { name: /既存/ });
    await user.click(screen.getByRole('button', { name: 'Note一覧を閉じる' }));

    expect(screen.getByRole('button', { name: 'Note一覧を開く' })).toBeInTheDocument();
    expect(document.querySelector('.list-nav-peek-zone')).toBeInTheDocument();
    expect(window.localStorage.getItem('jot-down-list-nav-collapsed')).toBe('true');

    unmount();
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Note一覧を開く' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Note一覧を開く' }));
    await user.click(screen.getByRole('button', { name: 'テンプレート管理' }));
    await user.click(screen.getByRole('button', { name: 'テンプレート一覧を閉じる' }));

    expect(screen.getByRole('button', { name: 'テンプレート一覧を開く' })).toBeInTheDocument();
    expect(window.localStorage.getItem('jot-down-list-nav-collapsed')).toBe('true');
  });
});
