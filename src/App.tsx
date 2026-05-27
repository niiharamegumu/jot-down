import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { EditorPane } from './components/EditorPane';
import { NoteList } from './components/NoteList';
import { deleteNote, loadNotes, putNote } from './data/notesDb';
import {
  createNote,
  matchesNoteSearch,
  normalizeSupportedMarkdown,
  sortNotesByUpdatedTime,
  type Note
} from './domain/note';

const starterMarkdown = `# 今日やること

- [ ] 買い物
- [x] メール返信

思いついたことをそのまま書けます。`;

const starterNoteId = 'starter-note';
const sidebarWidthStorageKey = 'jot-down-sidebar-width';
const minSidebarWidth = 260;
const maxSidebarWidth = 520;

export function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeMarkdown, setActiveMarkdown] = useState('');
  const [query, setQuery] = useState('');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => loadSidebarWidth());
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isInstalledPwa, setIsInstalledPwa] = useState(() => isRunningAsInstalledPwa());
  const [isApplyingAppUpdate, setIsApplyingAppUpdate] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const resizePointerIdRef = useRef<number | null>(null);
  const serviceWorkerRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_swScriptUrl, registration) {
      serviceWorkerRegistrationRef.current = registration ?? null;
    }
  });

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const visibleNotes = sortNotesByUpdatedTime(notes).filter((note) =>
    matchesNoteSearch(note, query)
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const loadedNotes = await loadNotes();
        const initialNotes =
          loadedNotes.length > 0 ? loadedNotes : [createNote(starterMarkdown, starterNoteId)];

        if (loadedNotes.length === 0) {
          await putNote(initialNotes[0]);
        }

        if (!cancelled) {
          const sortedNotes = sortNotesByUpdatedTime(initialNotes);
          setNotes(sortedNotes);
          setSelectedNoteId(sortedNotes[0]?.id ?? null);
          setActiveMarkdown(sortedNotes[0]?.markdown ?? '');
        }
      } catch (error) {
        if (!cancelled) {
          setStorageError(getStorageErrorMessage(error));
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedNote || activeMarkdown === selectedNote.markdown) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistActiveNote(activeMarkdown);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [activeMarkdown, selectedNote]);

  useEffect(() => {
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');

    function updateInstalledPwaState() {
      setIsInstalledPwa(isRunningAsInstalledPwa());
    }

    displayModeQuery.addEventListener('change', updateInstalledPwaState);
    window.addEventListener('online', handleOnline);

    return () => {
      displayModeQuery.removeEventListener('change', updateInstalledPwaState);
      window.removeEventListener('online', handleOnline);
    };

    function handleOnline() {
      void serviceWorkerRegistrationRef.current?.update();
    }
  }, []);

  function updateNotes(nextNote: Note) {
    setNotes((currentNotes) =>
      sortNotesByUpdatedTime(
        currentNotes.map((note) => (note.id === nextNote.id ? nextNote : note))
      )
    );
  }

  async function persistActiveNote(markdown: string): Promise<boolean> {
    if (!selectedNote || markdown === selectedNote.markdown) {
      return true;
    }

    const nextNote: Note = {
      ...selectedNote,
      markdown,
      updatedAt: new Date().toISOString()
    };

    updateNotes(nextNote);

    try {
      await putNote(nextNote);
      setStorageError(null);
      return true;
    } catch (error) {
      setStorageError(getStorageErrorMessage(error));
      return false;
    }
  }

  function handleMarkdownChange(markdown: string) {
    setActiveMarkdown(normalizeSupportedMarkdown(markdown));
  }

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);
  }

  async function handleCreateNote() {
    await persistActiveNote(activeMarkdown);

    const note = createNote();
    setNotes((currentNotes) => sortNotesByUpdatedTime([note, ...currentNotes]));
    setSelectedNoteId(note.id);
    setActiveMarkdown(note.markdown);
    setMobileView('editor');

    try {
      await putNote(note);
      setStorageError(null);
    } catch (error) {
      setStorageError(getStorageErrorMessage(error));
    }
  }

  async function handleSelectNote(noteId: string) {
    await persistActiveNote(activeMarkdown);
    const nextNote = notes.find((note) => note.id === noteId);
    if (!nextNote) {
      return;
    }

    setSelectedNoteId(nextNote.id);
    setActiveMarkdown(nextNote.markdown);
    setMobileView('editor');
  }

  async function handleDeleteNote() {
    if (!selectedNote) {
      return;
    }

    const confirmed = window.confirm('このNoteは削除され、復元できません。削除しますか？');
    if (!confirmed) {
      return;
    }

    try {
      await deleteNote(selectedNote.id);
      const remainingNotes = sortNotesByUpdatedTime(
        notes.filter((note) => note.id !== selectedNote.id)
      );
      const fallbackNotes = remainingNotes.length > 0 ? remainingNotes : [createNote()];

      if (remainingNotes.length === 0) {
        await putNote(fallbackNotes[0]);
      }

      setNotes(fallbackNotes);
      setSelectedNoteId(fallbackNotes[0].id);
      setActiveMarkdown(fallbackNotes[0].markdown);
      setMobileView('list');
      setStorageError(null);
    } catch (error) {
      setStorageError(getStorageErrorMessage(error));
    }
  }

  async function handleApplyAppUpdate() {
    setIsApplyingAppUpdate(true);
    const saved = await persistActiveNote(activeMarkdown);

    if (!saved) {
      setIsApplyingAppUpdate(false);
      return;
    }

    try {
      await updateServiceWorker(true);
    } catch (error) {
      console.error(error);
      setIsApplyingAppUpdate(false);
    }
  }

  return (
    <div
      ref={shellRef}
      className={`app-shell app-shell--${mobileView}${isResizingSidebar ? ' app-shell--resizing' : ''}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <NoteList
        notes={visibleNotes}
        selectedNoteId={selectedNoteId}
        query={query}
        onQueryChange={handleQueryChange}
        onCreateNote={handleCreateNote}
        onSelectNote={handleSelectNote}
      />
      <div
        className="pane-resizer"
        role="separator"
        aria-label="Note一覧の幅を変更"
        aria-orientation="vertical"
        aria-valuemin={minSidebarWidth}
        aria-valuemax={maxSidebarWidth}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        onPointerDown={handleResizePointerDown}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            commitSidebarWidth(sidebarWidth - 16);
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            commitSidebarWidth(sidebarWidth + 16);
          }
        }}
      />
      <EditorPane
        note={selectedNote}
        markdown={activeMarkdown}
        updatedAt={selectedNote?.updatedAt ?? null}
        storageError={storageError}
        appUpdateAvailable={isInstalledPwa && needRefresh}
        isApplyingAppUpdate={isApplyingAppUpdate}
        onMarkdownChange={handleMarkdownChange}
        onFlush={() => void persistActiveNote(activeMarkdown)}
        onApplyAppUpdate={handleApplyAppUpdate}
        onDeleteNote={handleDeleteNote}
        onBackToList={() => setMobileView('list')}
      />
    </div>
  );

  function handleResizePointerDown(event: PointerEvent<HTMLDivElement>) {
    const shellLeft = shellRef.current?.getBoundingClientRect().left ?? 0;
    const resizer = event.currentTarget;

    event.preventDefault();
    resizePointerIdRef.current = event.pointerId;
    setIsResizingSidebar(true);
    commitSidebarWidth(event.clientX - shellLeft);

    try {
      resizer.setPointerCapture(event.pointerId);
    } catch {
      resizePointerIdRef.current = null;
      setIsResizingSidebar(false);
      return;
    }

    function handlePointerMove(moveEvent: globalThis.PointerEvent) {
      if (moveEvent.pointerId !== resizePointerIdRef.current) {
        return;
      }

      commitSidebarWidth(moveEvent.clientX - shellLeft);
    }

    function handlePointerUp(upEvent: globalThis.PointerEvent) {
      if (upEvent.pointerId !== resizePointerIdRef.current) {
        return;
      }

      finishResize(upEvent);
    }

    function handlePointerCancel(cancelEvent: globalThis.PointerEvent) {
      if (cancelEvent.pointerId !== resizePointerIdRef.current) {
        return;
      }

      finishResize(cancelEvent);
    }

    function handleWindowBlur() {
      finishResize();
    }

    function handleKeyDown(keyEvent: globalThis.KeyboardEvent) {
      if (keyEvent.key === 'Escape') {
        finishResize();
      }
    }

    function finishResize(pointerEvent?: globalThis.PointerEvent) {
      if (pointerEvent && resizer.hasPointerCapture(pointerEvent.pointerId)) {
        resizer.releasePointerCapture(pointerEvent.pointerId);
      }

      resizePointerIdRef.current = null;
      setIsResizingSidebar(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown);
  }

  function commitSidebarWidth(width: number) {
    const nextWidth = Math.min(maxSidebarWidth, Math.max(minSidebarWidth, Math.round(width)));
    setSidebarWidth(nextWidth);
    window.localStorage.setItem(sidebarWidthStorageKey, String(nextWidth));
  }
}

function getStorageErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Local note storeが利用できません。ブラウザ設定や空き容量を確認してください。';
}

function loadSidebarWidth(): number {
  const storedValue = Number(window.localStorage.getItem(sidebarWidthStorageKey));
  if (!Number.isFinite(storedValue)) {
    return 360;
  }

  return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, storedValue));
}

function isRunningAsInstalledPwa(): boolean {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    standaloneNavigator.standalone === true
  );
}
