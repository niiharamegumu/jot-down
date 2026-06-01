import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import {
  deleteNotes,
  loadNotes,
  loadNoteTemplates,
  putNote,
  putNoteTemplate
} from './data/notesDb';

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
  deleteNotes: vi.fn(),
  putNoteTemplate: vi.fn(),
  deleteNoteTemplate: vi.fn()
}));

const loadNotesMock = vi.mocked(loadNotes);
const loadNoteTemplatesMock = vi.mocked(loadNoteTemplates);
const putNoteMock = vi.mocked(putNote);
const deleteNotesMock = vi.mocked(deleteNotes);
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

  it('duplicates the selected note using the latest visible Markdown', async () => {
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

    render(<App />);

    await screen.findByRole('option', { name: /既存/ });
    await user.type(screen.getByLabelText('Markdown editor'), '\n追加');
    await user.click(screen.getByRole('button', { name: 'Noteを複製' }));

    expect(await screen.findAllByRole('option', { name: /既存/ })).toHaveLength(2);
    expect(putNoteMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        markdown: '# 既存\n追加'
      })
    );
    expect(putNoteMock).toHaveBeenLastCalledWith(
      expect.not.objectContaining({
        id: 'note'
      })
    );
  });

  it('copies the selected note using the latest visible Markdown', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const restoreClipboard = mockClipboard(writeText);
    loadNotesMock.mockResolvedValue([
      {
        id: 'note',
        markdown: '# 既存',
        updatedAt: '2026-05-26T03:15:00.000Z'
      }
    ]);
    loadNoteTemplatesMock.mockResolvedValue([]);
    putNoteMock.mockResolvedValue();

    try {
      render(<App />);

      await screen.findByRole('option', { name: /既存/ });
      await user.type(screen.getByLabelText('Markdown editor'), '\n追加');
      await user.click(screen.getByRole('button', { name: 'Note Markdownをコピー' }));

      expect(writeText).toHaveBeenCalledWith('# 既存\n追加');
      expect(await screen.findByText('コピーしました')).toBeInTheDocument();
    } finally {
      restoreClipboard();
    }
  });

  it('deletes multiple deletion target notes from the note list', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    loadNotesMock.mockResolvedValue([
      {
        id: 'shopping',
        markdown: '# 買い物',
        updatedAt: '2026-05-27T03:15:00.000Z'
      },
      {
        id: 'ideas',
        markdown: '# アイデア',
        updatedAt: '2026-05-26T03:15:00.000Z'
      },
      {
        id: 'log',
        markdown: '# ログ',
        updatedAt: '2026-05-25T03:15:00.000Z'
      }
    ]);
    loadNoteTemplatesMock.mockResolvedValue([]);
    putNoteMock.mockResolvedValue();
    deleteNotesMock.mockResolvedValue();

    render(<App />);

    await screen.findByRole('option', { name: /買い物/ });
    await user.click(screen.getByRole('button', { name: '複数Noteを選択' }));
    await user.click(screen.getByRole('option', { name: /買い物/ }));
    await user.click(screen.getByRole('option', { name: /アイデア/ }));

    expect(screen.getByLabelText('2件選択中')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: '選択したNoteを削除' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      '選択した2件のNoteは削除され、復元できません。削除しますか？'
    );
    expect(deleteNotesMock).toHaveBeenCalledWith(['shopping', 'ideas']);
    expect(screen.queryByRole('option', { name: /買い物/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /アイデア/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /ログ/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByLabelText('2件選択中')).not.toBeInTheDocument();

    confirmSpy.mockRestore();
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
