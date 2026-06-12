import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { deriveNoteSnippet, deriveNoteTitle, type Note } from '../domain/note';
import type { NoteFolder } from '../domain/noteFolder';
import type { NoteTemplate } from '../domain/noteTemplate';

export type CommandPaletteAction = {
  id: string;
  label: string;
  aliases: string[];
  shortcut?: string;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  notes: Note[];
  noteFolders: NoteFolder[];
  actions: CommandPaletteAction[];
  templates: NoteTemplate[];
  onOpenNote: (noteId: string) => void;
  onInsertTemplate: (templateId: string) => void;
  onClose: () => void;
};

type CommandPaletteMode = 'default' | 'noteLookup' | 'templateLookup';

type CommandPaletteItem =
  | { type: 'note'; id: string; label: string; detail: string; meta: string; searchText: string }
  | {
      type: 'action';
      id: string;
      label: string;
      aliases: string[];
      searchText: string;
      shortcut: string | null;
      run: () => void;
    }
  | { type: 'template'; id: string; label: string; detail: string; searchText: string };

export function CommandPalette({
  open,
  notes,
  noteFolders,
  actions,
  templates,
  onOpenNote,
  onInsertTemplate,
  onClose
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<CommandPaletteMode>('default');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderNameById = useMemo(
    () => new Map(noteFolders.map((folder) => [folder.id, folder.name])),
    [noteFolders]
  );
  const noteItems = useMemo(
    () =>
      notes.map((note) => {
        const title = deriveNoteTitle(note.markdown);
        const snippet = deriveNoteSnippet(note.markdown);
        const folderName = note.folderId ? folderNameById.get(note.folderId) : null;

        return {
          type: 'note' as const,
          id: note.id,
          label: title,
          detail: snippet,
          meta: folderName ?? '未分類',
          searchText: normalizeSearchText(`${note.markdown} ${title} ${snippet}`)
        };
      }),
    [folderNameById, notes]
  );
  const actionItems = useMemo(
    () =>
      actions.map((action) => ({
        type: 'action' as const,
        id: action.id,
        label: action.label,
        aliases: action.aliases,
        searchText: normalizeSearchText([action.label, ...action.aliases].join(' ')),
        shortcut: action.shortcut ?? null,
        run: action.run
      })),
    [actions]
  );
  const templateItems = useMemo(
    () =>
      templates.map((template) => ({
        type: 'template' as const,
        id: template.id,
        label: template.name,
        detail: deriveNoteSnippet(template.markdown),
        searchText: normalizeSearchText(`${template.name} ${template.markdown}`)
      })),
    [templates]
  );
  const normalizedQuery = normalizeSearchText(query);
  const showLookupNotes = mode === 'noteLookup' || normalizedQuery.length > 0;
  const visibleNotes = showLookupNotes
    ? noteItems.filter((item) => item.searchText.includes(normalizedQuery))
    : [];
  const visibleActions =
    mode === 'default'
      ? actionItems.filter((item) =>
          normalizedQuery ? item.searchText.includes(normalizedQuery) : true
        )
      : [];
  const visibleTemplates =
    mode === 'templateLookup'
      ? templateItems.filter((item) =>
          normalizedQuery ? item.searchText.includes(normalizedQuery) : true
        )
      : [];
  const visibleItems: CommandPaletteItem[] = [
    ...visibleNotes,
    ...visibleTemplates,
    ...visibleActions
  ];

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery('');
    setMode('default');
    setActiveIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [mode, query]);

  useEffect(() => {
    if (activeIndex <= visibleItems.length - 1) {
      return;
    }

    setActiveIndex(Math.max(visibleItems.length - 1, 0));
  }, [activeIndex, visibleItems.length]);

  if (!open) {
    return null;
  }

  const title =
    mode === 'templateLookup'
      ? 'テンプレートを挿入'
      : mode === 'noteLookup'
        ? 'Noteを探して開く'
        : 'コマンド';
  const placeholder =
    mode === 'templateLookup'
      ? 'テンプレートを検索'
      : mode === 'noteLookup'
        ? 'Noteを検索'
        : 'NoteやActionを検索';

  return (
    <div className="command-palette-backdrop" onMouseDown={handleBackdropMouseDown}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label className="command-palette__field">
          <span className="visually-hidden">{placeholder}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            type="text"
          />
        </label>

        <div className="command-palette__results">
          {visibleNotes.length > 0 ? (
            <CommandPaletteGroup
              title="開く"
              items={visibleNotes}
              activeIndex={activeIndex}
              getItemIndex={(item) => visibleItems.indexOf(item)}
              onActivate={setActiveIndex}
              onSelect={runItem}
            />
          ) : null}
          {visibleTemplates.length > 0 ? (
            <CommandPaletteGroup
              title="挿入"
              items={visibleTemplates}
              activeIndex={activeIndex}
              getItemIndex={(item) => visibleItems.indexOf(item)}
              onActivate={setActiveIndex}
              onSelect={runItem}
            />
          ) : null}
          {visibleActions.length > 0 ? (
            <CommandPaletteGroup
              title="実行"
              items={visibleActions}
              activeIndex={activeIndex}
              getItemIndex={(item) => visibleItems.indexOf(item)}
              onActivate={setActiveIndex}
              onSelect={runItem}
            />
          ) : null}
          {visibleItems.length === 0 ? (
            <p className="command-palette__empty">一致する候補がありません</p>
          ) : null}
        </div>
      </section>
    </div>
  );

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((currentIndex) =>
        visibleItems.length === 0 ? 0 : (currentIndex + 1) % visibleItems.length
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((currentIndex) =>
        visibleItems.length === 0
          ? 0
          : (currentIndex - 1 + visibleItems.length) % visibleItems.length
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const item = visibleItems[activeIndex];
      if (item) {
        runItem(item);
      }
    }
  }

  function runItem(item: CommandPaletteItem) {
    if (item.type === 'note') {
      onOpenNote(item.id);
      return;
    }

    if (item.type === 'template') {
      onInsertTemplate(item.id);
      return;
    }

    if (item.id === 'open-note-lookup') {
      setMode('noteLookup');
      setQuery('');
      return;
    }

    if (item.id === 'insert-template') {
      setMode('templateLookup');
      setQuery('');
      return;
    }

    item.run();
  }

  function handleBackdropMouseDown() {
    onClose();
  }
}

type CommandPaletteGroupProps = {
  title: string;
  items: CommandPaletteItem[];
  activeIndex: number;
  getItemIndex: (item: CommandPaletteItem) => number;
  onActivate: (index: number) => void;
  onSelect: (item: CommandPaletteItem) => void;
};

function CommandPaletteGroup({
  title,
  items,
  activeIndex,
  getItemIndex,
  onActivate,
  onSelect
}: CommandPaletteGroupProps) {
  return (
    <section className="command-palette__group" aria-label={title}>
      <h2>{title}</h2>
      <div className="command-palette__items">
        {items.map((item) => {
          const itemIndex = getItemIndex(item);
          const active = itemIndex === activeIndex;

          return (
            <button
              key={`${item.type}-${item.id}`}
              className={`command-palette__item command-palette__item--${item.type}`}
              type="button"
              aria-selected={active}
              onMouseEnter={() => onActivate(itemIndex)}
              onClick={() => onSelect(item)}
            >
              <span className="command-palette__item-main">
                <CommandPaletteItemIcon type={item.type} id={item.id} />
                <span className="command-palette__item-label">{item.label}</span>
                {item.type === 'note' || item.type === 'template' ? (
                  <span className="command-palette__item-detail">{item.detail}</span>
                ) : null}
              </span>
              {item.type === 'note' ? (
                <span className="command-palette__item-meta">{item.meta}</span>
              ) : null}
              {item.type === 'action' && item.aliases.length > 0 ? (
                <span
                  className="command-palette__item-aliases"
                  aria-hidden="true"
                  data-aliases={item.aliases.join(' / ')}
                  title={item.aliases.join(' / ')}
                >
                  <span className="command-palette__item-aliases-text">
                    {item.aliases.join(' / ')}
                  </span>
                </span>
              ) : null}
              {item.type === 'action' && item.shortcut ? (
                <kbd className="command-palette__item-shortcut">{item.shortcut}</kbd>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CommandPaletteItemIcon({ type, id }: { type: CommandPaletteItem['type']; id: string }) {
  const path = getCommandPaletteItemIconPath(type, id);

  return (
    <svg className="command-palette__item-icon" aria-hidden="true" viewBox="0 0 24 24">
      {path.map((value) => (
        <path key={value} d={value} />
      ))}
    </svg>
  );
}

function getCommandPaletteItemIconPath(type: CommandPaletteItem['type'], id: string): string[] {
  if (type === 'note') {
    return ['M6 3h9l3 3v15H6z', 'M15 3v4h4', 'M9 12h6', 'M9 16h4'];
  }

  if (type === 'template') {
    return ['M6 3h9l3 3v15H6z', 'M15 3v4h4', 'M12 11v6', 'M9 14h6'];
  }

  if (id.includes('folder')) {
    return ['M3 7h7l2 2h9v9.5A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5z'];
  }

  if (id.includes('template')) {
    return ['M6 3h9l3 3v15H6z', 'M15 3v4h4', 'M9 12h6', 'M9 16h4'];
  }

  if (id.includes('copy') || id.includes('duplicate')) {
    return ['M8 8h10v12H8z', 'M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'];
  }

  if (id.includes('delete')) {
    return ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 15h10l1-15', 'M10 10v7', 'M14 10v7'];
  }

  if (id.includes('list-nav')) {
    return [
      'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5z',
      'M9 3v18'
    ];
  }

  if (id.includes('lookup')) {
    return ['M11 19a8 8 0 1 1 5.6-2.3L21 21'];
  }

  return ['M12 5v14', 'M5 12h14'];
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase('ja-JP');
}
