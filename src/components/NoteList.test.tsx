import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
    renderNoteList({
      notes,
      selectedNoteId: 'note-1'
    });

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
    const onOpenTemplateManagement = vi.fn();

    renderNoteList({
      notes,
      selectedNoteId: null,
      onQueryChange,
      onCreateNote,
      onSelectNote,
      onOpenTemplateManagement
    });

    await user.type(screen.getByRole('searchbox', { name: 'Noteを検索' }), '買い物');
    await user.click(screen.getByRole('button', { name: '新しいNoteを作成' }));
    await user.click(screen.getByRole('option', { name: /見出しなし/ }));
    await user.click(screen.getByRole('button', { name: 'テンプレート管理' }));

    expect(onQueryChange).toHaveBeenLastCalledWith('物');
    expect(onCreateNote).toHaveBeenCalledTimes(1);
    expect(onSelectNote).toHaveBeenCalledWith('note-2');
    expect(onOpenTemplateManagement).toHaveBeenCalledTimes(1);
  });

  it('places the note folder creation action before the multi-note selection action', () => {
    renderNoteList({ notes });

    const header = document.querySelector('.note-list__header') as HTMLElement;
    const headerActions = Array.from(header.querySelectorAll('button'));

    expect(headerActions[0]).toBe(screen.getByRole('button', { name: '新しいNote folderを作成' }));
    expect(headerActions[1]).toBe(screen.getByRole('button', { name: '複数Noteを選択' }));
  });

  it('lets the user mark deletion target notes in the dedicated mode', async () => {
    const user = userEvent.setup();
    const onStartDeletionTargetSelection = vi.fn();
    const onToggleDeletionTarget = vi.fn();
    const onDeleteDeletionTargets = vi.fn();
    const onCancelDeletionTargetSelection = vi.fn();

    const { rerender } = renderNoteList({
      notes,
      selectedNoteId: 'note-1',
      onStartDeletionTargetSelection,
      onToggleDeletionTarget,
      onDeleteDeletionTargets,
      onCancelDeletionTargetSelection
    });

    await user.click(screen.getByRole('button', { name: '複数Noteを選択' }));

    expect(onStartDeletionTargetSelection).toHaveBeenCalledTimes(1);

    rerender(
      <NoteList
        {...getNoteListProps({
          notes,
          selectedNoteId: 'note-1',
          deletionTargetNoteIds: ['note-2'],
          isDeletionTargetSelectionMode: true,
          onStartDeletionTargetSelection,
          onToggleDeletionTarget,
          onDeleteDeletionTargets,
          onCancelDeletionTargetSelection
        })}
      />
    );

    expect(screen.getByLabelText('1件選択中')).toHaveTextContent('1');
    expect(screen.getByRole('option', { name: /見出しなし/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await user.click(screen.getByRole('option', { name: /今日のNote/ }));
    await user.click(screen.getByRole('button', { name: '選択したNoteを削除' }));
    await user.click(screen.getByRole('button', { name: '複数選択をキャンセル' }));

    expect(onToggleDeletionTarget).toHaveBeenCalledWith('note-1');
    expect(onDeleteDeletionTargets).toHaveBeenCalledTimes(1);
    expect(onCancelDeletionTargetSelection).toHaveBeenCalledTimes(1);
  });

  it('collapses to a list navigation toggle', async () => {
    const user = userEvent.setup();
    const onToggleListNav = vi.fn();

    renderNoteList({
      notes,
      selectedNoteId: 'note-1',
      isListNavCollapsed: true,
      onToggleListNav
    });

    expect(screen.getByRole('button', { name: 'Note一覧を開く' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByRole('complementary', { name: 'Notes' })).toHaveClass(
      'note-list--collapsed'
    );
    expect(screen.getByRole('searchbox', { name: 'Noteを検索' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'テンプレート管理' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Note一覧を開く' }));

    expect(onToggleListNav).toHaveBeenCalledTimes(1);
  });

  it('groups folder notes above unfiled notes and toggles the folder open state', async () => {
    const user = userEvent.setup();
    const onToggleNoteFolderOpen = vi.fn();

    renderNoteList({
      notes: [{ ...notes[0], folderId: 'folder-a' }, notes[1]],
      noteFolders: [{ id: 'folder-a', name: '仕事' }],
      openNoteFolderIds: ['folder-a'],
      onToggleNoteFolderOpen
    });

    expect(screen.getByRole('group', { name: '仕事のNote' })).toBeInTheDocument();
    const folderToggle = screen.getAllByRole('button', { name: /仕事/ })[0];
    expect(folderToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: /今日のNote/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /見出しなし/ })).toBeInTheDocument();

    await user.click(folderToggle);

    expect(onToggleNoteFolderOpen).toHaveBeenCalledWith('folder-a');
  });

  it('moves a dragged note to a note folder drop target', () => {
    const onDragNote = vi.fn();
    const onMoveDraggedNotesToFolder = vi.fn();

    renderNoteList({
      notes,
      noteFolders: [{ id: 'folder-a', name: '仕事' }],
      openNoteFolderIds: ['folder-a'],
      onDragNote,
      onMoveDraggedNotesToFolder
    });

    const note = screen.getByRole('option', { name: /今日のNote/ });
    const folderHeader = screen
      .getByRole('group', { name: '仕事のNote' })
      .querySelector('.note-folder-group__header') as HTMLElement;

    fireEvent.dragStart(note);
    fireEvent.drop(folderHeader);

    expect(onDragNote).toHaveBeenCalledWith('note-1');
    expect(onMoveDraggedNotesToFolder).toHaveBeenCalledWith('folder-a');
  });

  it('keeps the peeking list navigation open while a note is being dragged', () => {
    const onHideListNavPeek = vi.fn();

    renderNoteList({
      notes,
      isNoteDragging: true,
      onHideListNavPeek
    });

    fireEvent.mouseLeave(screen.getByRole('complementary', { name: 'Notes' }));

    expect(onHideListNavPeek).not.toHaveBeenCalled();
  });

  it('marks only the active drop target while a note is being dragged over it', () => {
    renderNoteList({
      notes: [{ ...notes[0], folderId: 'folder-a' }, notes[1]],
      noteFolders: [{ id: 'folder-a', name: '仕事' }],
      openNoteFolderIds: ['folder-a'],
      isNoteDragging: true
    });

    const folderGroup = screen.getByRole('group', { name: '仕事のNote' });
    const unfiledArea = screen.getByLabelText('未分類Note領域');

    fireEvent.dragOver(folderGroup);

    expect(folderGroup).toHaveClass('note-folder-group--drop-target');
    expect(unfiledArea).not.toHaveClass('unfiled-drop-area--drop-target');

    fireEvent.dragOver(unfiledArea);

    expect(folderGroup).not.toHaveClass('note-folder-group--drop-target');
    expect(unfiledArea).toHaveClass('unfiled-drop-area--drop-target');
  });
});

type NoteListProps = ComponentProps<typeof NoteList>;

function getNoteListProps(overrides: Partial<NoteListProps> = {}): NoteListProps {
  return {
    notes,
    noteFolders: [],
    selectedNoteId: null,
    deletionTargetNoteIds: [],
    membershipChangeNoteIds: [],
    openNoteFolderIds: [],
    noteFolderEditor: null,
    isNoteDragging: false,
    isDeletionTargetSelectionMode: false,
    query: '',
    canToggleListNav: true,
    isListNavCollapsed: false,
    onQueryChange: vi.fn(),
    onCreateNote: vi.fn(),
    onStartCreateNoteFolder: vi.fn(),
    onSelectNote: vi.fn(),
    onStartDeletionTargetSelection: vi.fn(),
    onToggleDeletionTarget: vi.fn(),
    onToggleMembershipChangeNote: vi.fn(),
    onDragNote: vi.fn(),
    onFinishNoteDrag: vi.fn(),
    onMoveDraggedNotesToFolder: vi.fn(),
    onToggleNoteFolderOpen: vi.fn(),
    onStartRenameNoteFolder: vi.fn(),
    onChangeNoteFolderEditorName: vi.fn(),
    onSubmitNoteFolderEditor: vi.fn(),
    onCancelNoteFolderEditor: vi.fn(),
    onDeleteNoteFolder: vi.fn(),
    onDeleteDeletionTargets: vi.fn(),
    onCancelDeletionTargetSelection: vi.fn(),
    onOpenTemplateManagement: vi.fn(),
    onToggleListNav: vi.fn(),
    onHideListNavPeek: vi.fn(),
    ...overrides
  };
}

function renderNoteList(overrides: Partial<NoteListProps> = {}) {
  return render(<NoteList {...getNoteListProps(overrides)} />);
}
