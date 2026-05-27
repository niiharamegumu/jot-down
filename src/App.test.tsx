import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { loadNotes, putNote } from './data/notesDb';

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
        setMarkdown: vi.fn()
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
  putNote: vi.fn(),
  deleteNote: vi.fn()
}));

const loadNotesMock = vi.mocked(loadNotes);
const putNoteMock = vi.mocked(putNote);

describe('App', () => {
  it('creates and shows a starter note when the local note store is empty', async () => {
    loadNotesMock.mockResolvedValue([]);
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
    putNoteMock.mockResolvedValue();

    render(<App />);

    expect(await screen.findByRole('option', { name: /買い物/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /アイデア/ })).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Noteを検索' }), '牛乳');

    expect(screen.getByRole('option', { name: /買い物/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /アイデア/ })).not.toBeInTheDocument();
  });
});
