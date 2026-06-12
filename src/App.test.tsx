import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import {
  deleteNoteFolderAndNotes,
  deleteNotes,
  loadNoteFolders,
  loadNotes,
  loadNoteTemplates,
  putNote,
  putNoteFolder,
  putNotes,
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
  loadNoteFolders: vi.fn(),
  loadNoteTemplates: vi.fn(),
  putNote: vi.fn(),
  putNotes: vi.fn(),
  putNoteFolder: vi.fn(),
  deleteNote: vi.fn(),
  deleteNotes: vi.fn(),
  deleteNoteFolderAndNotes: vi.fn(),
  putNoteTemplate: vi.fn(),
  deleteNoteTemplate: vi.fn()
}));

const loadNotesMock = vi.mocked(loadNotes);
const loadNoteFoldersMock = vi.mocked(loadNoteFolders);
const loadNoteTemplatesMock = vi.mocked(loadNoteTemplates);
const putNoteMock = vi.mocked(putNote);
const putNotesMock = vi.mocked(putNotes);
const putNoteFolderMock = vi.mocked(putNoteFolder);
const deleteNotesMock = vi.mocked(deleteNotes);
const deleteNoteFolderAndNotesMock = vi.mocked(deleteNoteFolderAndNotes);
const putNoteTemplateMock = vi.mocked(putNoteTemplate);

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    loadNoteFoldersMock.mockResolvedValue([]);
    putNotesMock.mockResolvedValue();
    putNoteFolderMock.mockResolvedValue();
    deleteNoteFolderAndNotesMock.mockResolvedValue();
  });

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

  it('creates a note folder from the note list', async () => {
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
    await user.click(screen.getByRole('button', { name: '新しいNote folderを作成' }));
    await user.type(screen.getByRole('textbox', { name: 'Note folder name' }), '仕事');
    await user.click(screen.getByRole('button', { name: 'Note folderを保存' }));

    expect(putNoteFolderMock).toHaveBeenCalledWith(expect.objectContaining({ name: '仕事' }));
    expect(await screen.findByRole('group', { name: '仕事のNote' })).toBeInTheDocument();
  });

  it('moves an unfiled note into a note folder by drag and drop', async () => {
    loadNotesMock.mockResolvedValue([
      {
        id: 'note',
        markdown: '# 既存',
        updatedAt: '2026-05-26T03:15:00.000Z'
      }
    ]);
    loadNoteFoldersMock.mockResolvedValue([{ id: 'work', name: '仕事' }]);
    loadNoteTemplatesMock.mockResolvedValue([]);
    putNoteMock.mockResolvedValue();

    render(<App />);

    const note = await screen.findByRole('option', { name: /既存/ });
    const folderHeader = screen
      .getByRole('group', { name: '仕事のNote' })
      .querySelector('.note-folder-group__header') as HTMLElement;

    fireEvent.dragStart(note);
    fireEvent.drop(folderHeader);

    expect(putNotesMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'note', folderId: 'work' })
    ]);
  });

  it('deletes a note folder with its contained notes', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    loadNotesMock.mockResolvedValue([
      {
        id: 'work-note',
        markdown: '# 仕事',
        folderId: 'work',
        updatedAt: '2026-05-27T03:15:00.000Z'
      },
      {
        id: 'log',
        markdown: '# ログ',
        updatedAt: '2026-05-26T03:15:00.000Z'
      }
    ]);
    loadNoteFoldersMock.mockResolvedValue([{ id: 'work', name: '仕事' }]);
    loadNoteTemplatesMock.mockResolvedValue([]);
    putNoteMock.mockResolvedValue();

    render(<App />);

    await screen.findByRole('option', { name: /仕事/ });
    await user.click(screen.getByRole('button', { name: '仕事と配下のNoteを削除' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      '仕事と配下の1件のNoteは削除され、復元できません。削除しますか？'
    );
    expect(deleteNoteFolderAndNotesMock).toHaveBeenCalledWith('work', ['work-note']);
    expect(screen.queryByRole('group', { name: '仕事のNote' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /ログ/ })).toHaveAttribute('aria-selected', 'true');

    confirmSpy.mockRestore();
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

  it('opens the command palette from the app-wide shortcut and opens a matching note', async () => {
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

    expect(await screen.findByRole('option', { name: /買い物/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const palette = screen.getByRole('dialog', { name: 'コマンド' });
    expect(screen.queryByRole('button', { name: 'ショートカット一覧' })).not.toBeInTheDocument();

    await user.type(within(palette).getByRole('textbox', { name: 'NoteやActionを検索' }), '散歩');
    await user.click(within(palette).getByRole('button', { name: /アイデア/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /アイデア/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('searchbox', { name: 'Noteを検索' })).toHaveValue('');
  });

  it('creates an unfiled note from the command palette', async () => {
    const user = userEvent.setup();
    loadNotesMock.mockResolvedValue([
      {
        id: 'work-note',
        markdown: '# 仕事',
        folderId: 'work',
        updatedAt: '2026-05-27T03:15:00.000Z'
      }
    ]);
    loadNoteFoldersMock.mockResolvedValue([{ id: 'work', name: '仕事' }]);
    loadNoteTemplatesMock.mockResolvedValue([]);
    putNoteMock.mockResolvedValue();

    render(<App />);

    await screen.findByRole('option', { name: /仕事/ });

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await user.click(
      within(screen.getByRole('dialog', { name: 'コマンド' })).getByRole('button', {
        name: '新しいNoteを作成'
      })
    );

    expect(putNoteMock).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: null }));
  });

  it('starts note folder creation from the command palette even when the note list is hidden', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Note一覧を閉じる' }));

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await user.click(
      within(screen.getByRole('dialog', { name: 'コマンド' })).getByRole('button', {
        name: 'Note folderを作成'
      })
    );

    expect(screen.getByRole('textbox', { name: 'Note folder name' })).toBeInTheDocument();
    expect(window.localStorage.getItem('jot-down-list-nav-collapsed')).toBe('false');
  });

  it('shows shortcut help across note and template views', async () => {
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

    expect(screen.getByRole('button', { name: 'ショートカット一覧' })).toBeInTheDocument();
    expect(screen.getByText('⌘ / Ctrl + K')).toBeInTheDocument();
    expect(screen.getByText('タスクのチェックを切り替え')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'テンプレート管理' }));

    expect(screen.getByRole('button', { name: 'ショートカット一覧' })).toBeInTheDocument();
    expect(screen.getByText('⌘ / Ctrl + K')).toBeInTheDocument();
    expect(screen.queryByText('タスクのチェックを切り替え')).not.toBeInTheDocument();
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

  it('hides peeking list navigation when the pointer leaves the visible list area', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Note一覧を閉じる' }));

    const listNav = screen.getByRole('complementary', { name: 'Notes' });
    vi.spyOn(listNav, 'getBoundingClientRect').mockReturnValue(
      createDomRect({ left: 12, right: 372, top: 12, bottom: 780 })
    );

    fireEvent.mouseEnter(document.querySelector('.list-nav-peek-zone') as Element);

    expect(document.querySelector('.app-shell--list-nav-peeking')).toBeInTheDocument();

    fireEvent.pointerMove(document, { clientX: 420, clientY: 120 });

    expect(document.querySelector('.app-shell--list-nav-peeking')).not.toBeInTheDocument();
  });

  it('hides peeking list navigation when the pointer leaves the viewport', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Note一覧を閉じる' }));

    fireEvent.mouseEnter(document.querySelector('.list-nav-peek-zone') as Element);

    expect(document.querySelector('.app-shell--list-nav-peeking')).toBeInTheDocument();

    fireEvent.pointerOut(document, { clientX: -1, clientY: 120, relatedTarget: null });

    expect(document.querySelector('.app-shell--list-nav-peeking')).not.toBeInTheDocument();
  });

  it('uses separate note template list and detail views on small screens without list navigation toggles', async () => {
    const user = userEvent.setup();
    const restoreMatchMedia = mockSmallScreen();
    window.localStorage.setItem('jot-down-list-nav-collapsed', 'true');
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
    putNoteTemplateMock.mockResolvedValue();

    try {
      render(<App />);

      await screen.findByRole('option', { name: /既存/ });

      expect(screen.queryByRole('button', { name: 'Note一覧を開く' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Note一覧を閉じる' })).not.toBeInTheDocument();
      expect(document.querySelector('.list-nav-peek-zone')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'テンプレート管理' }));

      expect(screen.getByRole('option', { name: /会議/ })).toBeInTheDocument();
      expect(screen.queryByLabelText('Markdown editor')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'テンプレート一覧を閉じる' })
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole('option', { name: /会議/ }));

      expect(screen.getByLabelText('Markdown editor')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'テンプレート一覧へ戻る' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /会議/ })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'テンプレート一覧へ戻る' }));

      expect(screen.getByRole('option', { name: /会議/ })).toBeInTheDocument();
      expect(screen.queryByLabelText('Markdown editor')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '新しいテンプレートを作成' }));

      expect(screen.getByRole('button', { name: 'テンプレート一覧へ戻る' })).toBeInTheDocument();
      expect(screen.getByLabelText('Markdown editor')).toBeInTheDocument();
    } finally {
      restoreMatchMedia();
    }
  });
});

function mockSmallScreen() {
  const originalMatchMedia = window.matchMedia;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: query === '(max-width: 760px)',
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    })
  });

  return () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia
    });
  };
}

function createDomRect({
  left,
  right,
  top,
  bottom
}: {
  left: number;
  right: number;
  top: number;
  bottom: number;
}): DOMRect {
  return {
    left,
    right,
    top,
    bottom,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({})
  } as DOMRect;
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
