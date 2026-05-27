import type { Note } from '../domain/note';
import { deriveNoteSnippet, deriveNoteTitle } from '../domain/note';

type NoteListProps = {
  notes: Note[];
  selectedNoteId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onCreateNote: () => void;
  onSelectNote: (noteId: string) => void;
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
  onSelectNote
}: NoteListProps) {
  return (
    <aside className="note-list" aria-label="Notes">
      <div className="note-list__header">
        <button
          className="icon-button"
          type="button"
          onClick={onCreateNote}
          aria-label="新しいNoteを作成"
        >
          +
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
    </aside>
  );
}
