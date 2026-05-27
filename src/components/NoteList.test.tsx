import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NoteList } from './NoteList';

const notes = [
  {
    id: 'note-1',
    markdown: '# 今日のNote\n- [ ] 買い物',
    updatedAt: '2026-05-27T03:15:00.000Z'
  },
  {
    id: 'note-2',
    markdown: '見出しなし\n本文',
    updatedAt: '2026-05-26T03:15:00.000Z'
  }
];

describe('NoteList', () => {
  it('shows note titles, snippets, and the selected note', () => {
    render(
      <NoteList
        notes={notes}
        selectedNoteId="note-1"
        query=""
        onQueryChange={vi.fn()}
        onCreateNote={vi.fn()}
        onSelectNote={vi.fn()}
      />
    );

    expect(screen.getByRole('option', { name: /今日のNote/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText('今日のNote 買い物')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /見出しなし/ })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('lets the user search notes, create a note, and select a note', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const onCreateNote = vi.fn();
    const onSelectNote = vi.fn();

    render(
      <NoteList
        notes={notes}
        selectedNoteId={null}
        query=""
        onQueryChange={onQueryChange}
        onCreateNote={onCreateNote}
        onSelectNote={onSelectNote}
      />
    );

    await user.type(screen.getByRole('searchbox', { name: 'Noteを検索' }), '買い物');
    await user.click(screen.getByRole('button', { name: '新しいNoteを作成' }));
    await user.click(screen.getByRole('option', { name: /見出しなし/ }));

    expect(onQueryChange).toHaveBeenLastCalledWith('物');
    expect(onCreateNote).toHaveBeenCalledTimes(1);
    expect(onSelectNote).toHaveBeenCalledWith('note-2');
  });
});
