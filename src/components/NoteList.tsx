import { useState, type DragEvent, type Ref } from 'react';
import type { Note } from '../domain/note';
import type { NoteFolder } from '../domain/noteFolder';
import { deriveNoteSnippet, deriveNoteTitle } from '../domain/note';

type NoteListProps = {
  notes: Note[];
  noteFolders: NoteFolder[];
  selectedNoteId: string | null;
  deletionTargetNoteIds: string[];
  membershipChangeNoteIds: string[];
  openNoteFolderIds: string[];
  noteFolderEditor: { name: string; error: string | null } | null;
  isNoteDragging: boolean;
  isDeletionTargetSelectionMode: boolean;
  query: string;
  canToggleListNav: boolean;
  isListNavCollapsed: boolean;
  listNavRef?: Ref<HTMLElement>;
  onQueryChange: (query: string) => void;
  onCreateNote: (folderId?: string | null) => void;
  onStartCreateNoteFolder: () => void;
  onSelectNote: (noteId: string) => void;
  onStartDeletionTargetSelection: () => void;
  onToggleDeletionTarget: (noteId: string) => void;
  onToggleMembershipChangeNote: (noteId: string) => void;
  onDragNote: (noteId: string) => void;
  onFinishNoteDrag: () => void;
  onMoveDraggedNotesToFolder: (folderId: string | null) => void;
  onToggleNoteFolderOpen: (folderId: string) => void;
  onStartRenameNoteFolder: (folderId: string) => void;
  onChangeNoteFolderEditorName: (name: string) => void;
  onSubmitNoteFolderEditor: () => void;
  onCancelNoteFolderEditor: () => void;
  onDeleteNoteFolder: (folderId: string) => void;
  onDeleteDeletionTargets: () => void;
  onCancelDeletionTargetSelection: () => void;
  onOpenTemplateManagement: () => void;
  onToggleListNav: () => void;
  onHideListNavPeek: () => void;
};

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

type ActiveDropTarget = { type: 'folder'; id: string } | { type: 'unfiled' } | null;

export function NoteList({
  notes,
  noteFolders,
  selectedNoteId,
  deletionTargetNoteIds,
  membershipChangeNoteIds,
  openNoteFolderIds,
  noteFolderEditor,
  isNoteDragging,
  isDeletionTargetSelectionMode,
  query,
  canToggleListNav,
  isListNavCollapsed,
  listNavRef,
  onQueryChange,
  onCreateNote,
  onStartCreateNoteFolder,
  onSelectNote,
  onStartDeletionTargetSelection,
  onToggleDeletionTarget,
  onToggleMembershipChangeNote,
  onDragNote,
  onFinishNoteDrag,
  onMoveDraggedNotesToFolder,
  onToggleNoteFolderOpen,
  onStartRenameNoteFolder,
  onChangeNoteFolderEditorName,
  onSubmitNoteFolderEditor,
  onCancelNoteFolderEditor,
  onDeleteNoteFolder,
  onDeleteDeletionTargets,
  onCancelDeletionTargetSelection,
  onOpenTemplateManagement,
  onToggleListNav,
  onHideListNavPeek
}: NoteListProps) {
  const [activeDropTarget, setActiveDropTarget] = useState<ActiveDropTarget>(null);
  const deletionTargetCount = deletionTargetNoteIds.length;
  const folderIdSet = new Set(noteFolders.map((folder) => folder.id));
  const hasQuery = query.trim().length > 0;
  const unfiledNotes = notes.filter((note) => !note.folderId || !folderIdSet.has(note.folderId));

  return (
    <aside
      ref={listNavRef}
      className={`note-list${isListNavCollapsed ? ' note-list--collapsed' : ''}`}
      aria-label="Notes"
      onMouseLeave={() => {
        if (!isNoteDragging) {
          onHideListNavPeek();
        }
      }}
    >
      <div className="note-list__header">
        {isDeletionTargetSelectionMode ? (
          <div className="note-list__selection-actions">
            <span
              className="note-list__selection-count"
              aria-label={`${deletionTargetCount}件選択中`}
            >
              {deletionTargetCount}
            </span>
            <button
              className="delete-button"
              type="button"
              onClick={onDeleteDeletionTargets}
              disabled={deletionTargetCount === 0}
              aria-label="選択したNoteを削除"
              data-tooltip="選択したNoteを削除"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M6 6l1 15h10l1-15" />
                <path d="M10 10v7" />
                <path d="M14 10v7" />
              </svg>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={onCancelDeletionTargetSelection}
              aria-label="複数選択をキャンセル"
              data-tooltip="複数選択をキャンセル"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <button
              className="icon-button note-list__create-folder-button"
              type="button"
              onClick={onStartCreateNoteFolder}
              aria-label="新しいNote folderを作成"
              data-tooltip="新しいNote folderを作成"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M3 7h7l2 2h9v9.5A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5z" />
                <path d="M12 13v5" />
                <path d="M9.5 15.5h5" />
              </svg>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={onStartDeletionTargetSelection}
              aria-label="複数Noteを選択"
              data-tooltip="複数Noteを選択"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M4 6h4v4H4z" />
                <path d="M11 8h9" />
                <path d="M4 14h4v4H4z" />
                <path d="M11 16h9" />
              </svg>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => onCreateNote()}
              aria-label="新しいNoteを作成"
              data-tooltip="新しいNoteを作成"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </button>
          </>
        )}
      </div>

      <label className="search">
        <span className="visually-hidden">Noteを検索</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="検索"
          type="search"
        />
      </label>

      {noteFolderEditor ? (
        <form
          className="note-folder-editor"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitNoteFolderEditor();
          }}
        >
          <label className="note-folder-editor__field">
            <span className="visually-hidden">Note folder name</span>
            <input
              autoFocus
              value={noteFolderEditor.name}
              onChange={(event) => onChangeNoteFolderEditorName(event.currentTarget.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="フォルダ名"
              aria-label="Note folder name"
            />
          </label>
          <button className="icon-button" type="submit" aria-label="Note folderを保存">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onCancelNoteFolderEditor}
            aria-label="Note folder編集をキャンセル"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
          {noteFolderEditor.error ? (
            <span className="note-folder-editor__error" role="alert">
              {noteFolderEditor.error}
            </span>
          ) : null}
        </form>
      ) : null}

      <div
        className="note-list__items"
        role="listbox"
        aria-label="Note一覧"
        aria-multiselectable={isDeletionTargetSelectionMode || undefined}
      >
        {noteFolders.map((folder) => {
          const folderNotes = notes.filter((note) => note.folderId === folder.id);
          if (hasQuery && folderNotes.length === 0) {
            return null;
          }

          const isOpen = hasQuery || openNoteFolderIds.includes(folder.id);

          return (
            <section
              key={folder.id}
              className={`note-folder-group${activeDropTarget?.type === 'folder' && activeDropTarget.id === folder.id ? ' note-folder-group--drop-target' : ''}`}
              role="group"
              aria-label={`${folder.name}のNote`}
              onDragLeave={(event) => clearDropTargetOnLeave(event)}
              onDragOver={(event) => {
                event.preventDefault();
                setActiveDropTarget({ type: 'folder', id: folder.id });
              }}
              onDrop={() => {
                setActiveDropTarget(null);
                onMoveDraggedNotesToFolder(folder.id);
              }}
            >
              <div className="note-folder-group__header">
                <button
                  className="note-folder-group__toggle"
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => onToggleNoteFolderOpen(folder.id)}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d={isOpen ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} />
                  </svg>
                  <span className="note-folder-group__name">{folder.name}</span>
                  <span className="note-folder-group__count">{folderNotes.length}</span>
                </button>
                <div className="note-folder-group__actions">
                  <button
                    className="icon-button note-folder-group__menu-trigger"
                    type="button"
                    aria-label={`${folder.name}の操作`}
                    aria-haspopup="true"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M6 12h.01" />
                      <path d="M12 12h.01" />
                      <path d="M18 12h.01" />
                    </svg>
                  </button>
                  <div className="note-folder-group__action-menu" role="toolbar">
                    <button
                      className="note-folder-group__action"
                      type="button"
                      onClick={() => onCreateNote(folder.id)}
                      aria-label={`${folder.name}にNoteを作成`}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                      <span>Noteを作成</span>
                    </button>
                    <button
                      className="note-folder-group__action"
                      type="button"
                      onClick={() => onStartRenameNoteFolder(folder.id)}
                      aria-label={`${folder.name}の名前を変更`}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                      <span>名前を変更</span>
                    </button>
                    <button
                      className="note-folder-group__action note-folder-group__action--delete"
                      type="button"
                      onClick={() => onDeleteNoteFolder(folder.id)}
                      aria-label={`${folder.name}と配下のNoteを削除`}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M6 6l1 15h10l1-15" />
                        <path d="M10 10v7" />
                        <path d="M14 10v7" />
                      </svg>
                      <span>削除</span>
                    </button>
                  </div>
                </div>
              </div>
              {isOpen ? folderNotes.map(renderNoteCard) : null}
            </section>
          );
        })}

        <div
          className={`unfiled-drop-area${activeDropTarget?.type === 'unfiled' ? ' unfiled-drop-area--drop-target' : ''}`}
          onDragLeave={(event) => clearDropTargetOnLeave(event)}
          onDragOver={(event) => {
            event.preventDefault();
            setActiveDropTarget({ type: 'unfiled' });
          }}
          onDrop={() => {
            setActiveDropTarget(null);
            onMoveDraggedNotesToFolder(null);
          }}
          aria-label="未分類Note領域"
        >
          {unfiledNotes.map(renderNoteCard)}
        </div>
      </div>

      <div className="note-list__footer">
        {canToggleListNav ? (
          <button
            className="icon-button"
            type="button"
            onClick={onToggleListNav}
            aria-label={isListNavCollapsed ? 'Note一覧を開く' : 'Note一覧を閉じる'}
            aria-expanded={!isListNavCollapsed}
            data-tooltip={isListNavCollapsed ? 'Note一覧を開く' : 'Note一覧を閉じる'}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5z" />
              <path d="M9 3v18" />
              <path d="M6.5 7h.01" />
              <path d="M6.5 11h.01" />
            </svg>
          </button>
        ) : null}
        <button
          className="icon-button"
          type="button"
          onClick={onOpenTemplateManagement}
          aria-label="テンプレート管理"
          data-tooltip="テンプレート管理"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M6 3h9l3 3v15H6z" />
            <path d="M15 3v4h4" />
            <path d="M9 12h6" />
            <path d="M9 16h6" />
          </svg>
        </button>
      </div>
    </aside>
  );

  function renderNoteCard(note: Note) {
    const isDeletionTarget = deletionTargetNoteIds.includes(note.id);
    const isMembershipChangeTarget = membershipChangeNoteIds.includes(note.id);
    const selected = isDeletionTargetSelectionMode ? isDeletionTarget : note.id === selectedNoteId;
    const title = deriveNoteTitle(note.markdown);
    const snippet = deriveNoteSnippet(note.markdown);

    return (
      <button
        key={note.id}
        className={`note-card${isDeletionTargetSelectionMode ? ' note-card--targetable' : ''}${isMembershipChangeTarget ? ' note-card--membership-target' : ''}${note.id === selectedNoteId ? ' note-card--open' : ''}`}
        type="button"
        role="option"
        aria-selected={selected}
        draggable={!isDeletionTargetSelectionMode}
        onDragStart={() => onDragNote(note.id)}
        onDragEnd={() => {
          setActiveDropTarget(null);
          onFinishNoteDrag();
        }}
        onClick={(event) => {
          if (isDeletionTargetSelectionMode) {
            onToggleDeletionTarget(note.id);
            return;
          }
          if (event.metaKey || event.ctrlKey) {
            onToggleMembershipChangeNote(note.id);
            return;
          }
          onSelectNote(note.id);
        }}
      >
        {isDeletionTargetSelectionMode ? (
          <span className="note-card__target-check" aria-hidden="true">
            {isDeletionTarget ? (
              <svg viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : null}
          </span>
        ) : null}
        <span className="note-card__title">{title}</span>
        <span className="note-card__meta">{dateFormatter.format(new Date(note.updatedAt))}</span>
        <span className="note-card__snippet">{snippet}</span>
      </button>
    );
  }

  function clearDropTargetOnLeave(event: DragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setActiveDropTarget(null);
  }
}
