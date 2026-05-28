import type { Note } from '../domain/note';
import { deriveNoteSnippet, deriveNoteTitle } from '../domain/note';

type NoteListProps = {
  notes: Note[];
  selectedNoteId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onCreateNote: () => void;
  onSelectNote: (noteId: string) => void;
  onOpenTemplateManagement: () => void;
};

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export function NoteList({
  notes,
  selectedNoteId,
  query,
  onQueryChange,
  onCreateNote,
  onSelectNote,
  onOpenTemplateManagement
}: NoteListProps) {
  return (
    <aside className="note-list" aria-label="Notes">
      <div className="note-list__header">
        <button
          className="icon-button"
          type="button"
          onClick={onCreateNote}
          aria-label="新しいNoteを作成"
          data-tooltip="新しいNoteを作成"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
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

      <div className="note-list__items" role="listbox" aria-label="Note一覧">
        {notes.map((note) => {
          const selected = note.id === selectedNoteId;
          const title = deriveNoteTitle(note.markdown);
          const snippet = deriveNoteSnippet(note.markdown);

          return (
            <button
              key={note.id}
              className="note-card"
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelectNote(note.id)}
            >
              <span className="note-card__title">{title}</span>
              <span className="note-card__meta">
                {dateFormatter.format(new Date(note.updatedAt))}
              </span>
              <span className="note-card__snippet">{snippet}</span>
            </button>
          );
        })}
      </div>

      <div className="note-list__footer">
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
}
