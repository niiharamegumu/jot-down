import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { EditorPane } from './components/EditorPane';
import { NoteList } from './components/NoteList';
import { TemplateManager } from './components/TemplateManager';
import {
  deleteNote,
  deleteNotes,
  deleteNoteTemplate,
  loadNotes,
  loadNoteTemplates,
  putNote,
  putNoteTemplate
} from './data/notesDb';
import {
  createNote,
  duplicateNote,
  matchesNoteSearch,
  normalizeSupportedMarkdown,
  sortNotesByUpdatedTime,
  type Note
} from './domain/note';
import {
  createNoteTemplate,
  getApplicableNoteTemplates,
  sortNoteTemplatesByName,
  type NoteTemplate
} from './domain/noteTemplate';

const starterMarkdown = `# 今日やること

- [ ] 買い物
- [x] メール返信

思いついたことをそのまま書けます。`;

const starterNoteId = 'starter-note';
const sidebarWidthStorageKey = 'jot-down-sidebar-width';
const listNavCollapsedStorageKey = 'jot-down-list-nav-collapsed';
const smallScreenMediaQuery = '(max-width: 760px)';
const minSidebarWidth = 260;
const maxSidebarWidth = 520;

export function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteTemplates, setNoteTemplates] = useState<NoteTemplate[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [deletionTargetNoteIds, setDeletionTargetNoteIds] = useState<string[]>([]);
  const [isDeletionTargetSelectionMode, setIsDeletionTargetSelectionMode] = useState(false);
  const [activeMarkdown, setActiveMarkdown] = useState('');
  const [activeTemplateName, setActiveTemplateName] = useState('');
  const [activeTemplateMarkdown, setActiveTemplateMarkdown] = useState('');
  const [query, setQuery] = useState('');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => loadSidebarWidth());
  const [isListNavCollapsed, setIsListNavCollapsed] = useState(() => loadListNavCollapsed());
  const [isListNavPeeking, setIsListNavPeeking] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(() => matchesSmallScreen());
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [templateMobileView, setTemplateMobileView] = useState<'list' | 'editor'>('list');
  const [appView, setAppView] = useState<'notes' | 'templates'>('notes');
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isInstalledPwa, setIsInstalledPwa] = useState(() => isRunningAsInstalledPwa());
  const [isApplyingAppUpdate, setIsApplyingAppUpdate] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const listNavElementRef = useRef<HTMLElement | null>(null);
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
  const selectedTemplate =
    noteTemplates.find((template) => template.id === selectedTemplateId) ?? null;
  const visibleNotes = sortNotesByUpdatedTime(notes).filter((note) =>
    matchesNoteSearch(note, query)
  );
  const applicableTemplates = getApplicableNoteTemplates(noteTemplates);
  const effectiveListNavCollapsed = isListNavCollapsed && !isSmallScreen;
  const canToggleListNav = !isSmallScreen;

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const loadedNotes = await loadNotes();
        const loadedTemplates = await loadNoteTemplates();
        const initialNotes =
          loadedNotes.length > 0 ? loadedNotes : [createNote(starterMarkdown, starterNoteId)];

        if (loadedNotes.length === 0) {
          await putNote(initialNotes[0]);
        }

        if (!cancelled) {
          const sortedNotes = sortNotesByUpdatedTime(initialNotes);
          setNotes(sortedNotes);
          const sortedTemplates = sortNoteTemplatesByName(loadedTemplates);
          setNoteTemplates(sortedTemplates);
          setSelectedNoteId(sortedNotes[0]?.id ?? null);
          setSelectedTemplateId(sortedTemplates[0]?.id ?? null);
          setActiveMarkdown(sortedNotes[0]?.markdown ?? '');
          setActiveTemplateName(sortedTemplates[0]?.name ?? '');
          setActiveTemplateMarkdown(sortedTemplates[0]?.markdown ?? '');
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
    setDeletionTargetNoteIds((currentIds) =>
      currentIds.filter((id) => notes.some((note) => note.id === id))
    );
  }, [notes]);

  useEffect(() => {
    if (
      !selectedTemplate ||
      (activeTemplateName === selectedTemplate.name &&
        activeTemplateMarkdown === selectedTemplate.markdown)
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistActiveTemplate(activeTemplateName, activeTemplateMarkdown);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [activeTemplateMarkdown, activeTemplateName, selectedTemplate]);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia(smallScreenMediaQuery);

    function updateSmallScreenState() {
      setIsSmallScreen(mediaQuery.matches);
      setIsListNavPeeking(false);
    }

    updateSmallScreenState();
    mediaQuery.addEventListener('change', updateSmallScreenState);

    return () => mediaQuery.removeEventListener('change', updateSmallScreenState);
  }, []);

  useEffect(() => {
    if (!isListNavPeeking || !effectiveListNavCollapsed) {
      return;
    }

    function hideListNavPeek() {
      setIsListNavPeeking(false);
    }

    function isPointerInsideListNav(event: globalThis.PointerEvent) {
      const listNavElement = listNavElementRef.current;

      if (!listNavElement) {
        return false;
      }

      const rect = listNavElement.getBoundingClientRect();

      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    }

    function isPointerInsidePeekZone(event: globalThis.PointerEvent) {
      return (
        event.clientX >= 0 &&
        event.clientX <= 32 &&
        event.clientY >= 0 &&
        event.clientY <= window.innerHeight
      );
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      if (isPointerInsideListNav(event) || isPointerInsidePeekZone(event)) {
        return;
      }

      hideListNavPeek();
    }

    function handlePointerOut(event: globalThis.PointerEvent) {
      if (event.relatedTarget === null) {
        hideListNavPeek();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hideListNavPeek();
      }
    }

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerout', handlePointerOut);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', hideListNavPeek);
    window.addEventListener('pointercancel', hideListNavPeek);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerout', handlePointerOut);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', hideListNavPeek);
      window.removeEventListener('pointercancel', hideListNavPeek);
    };
  }, [effectiveListNavCollapsed, isListNavPeeking]);

  const setListNavElementRef = useCallback((element: HTMLElement | null) => {
    listNavElementRef.current = element;
  }, []);

  function updateNotes(nextNote: Note) {
    setNotes((currentNotes) =>
      sortNotesByUpdatedTime(
        currentNotes.map((note) => (note.id === nextNote.id ? nextNote : note))
      )
    );
  }

  function updateNoteTemplates(nextTemplate: NoteTemplate) {
    setNoteTemplates((currentTemplates) =>
      sortNoteTemplatesByName(
        currentTemplates.map((template) =>
          template.id === nextTemplate.id ? nextTemplate : template
        )
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

  async function persistActiveTemplate(name: string, markdown: string): Promise<boolean> {
    if (
      !selectedTemplate ||
      (name === selectedTemplate.name && markdown === selectedTemplate.markdown)
    ) {
      return true;
    }

    const nextTemplate: NoteTemplate = {
      ...selectedTemplate,
      name,
      markdown,
      updatedAt: new Date().toISOString()
    };

    updateNoteTemplates(nextTemplate);

    try {
      await putNoteTemplate(nextTemplate);
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

  function handleTemplateNameChange(name: string) {
    setActiveTemplateName(name);
  }

  function handleTemplateMarkdownChange(markdown: string) {
    setActiveTemplateMarkdown(normalizeSupportedMarkdown(markdown));
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

  async function handleCreateTemplate() {
    await persistActiveTemplate(activeTemplateName, activeTemplateMarkdown);

    const template = createNoteTemplate();
    setNoteTemplates((currentTemplates) =>
      sortNoteTemplatesByName([template, ...currentTemplates])
    );
    setSelectedTemplateId(template.id);
    setActiveTemplateName(template.name);
    setActiveTemplateMarkdown(template.markdown);
    setTemplateMobileView('editor');

    try {
      await putNoteTemplate(template);
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

  async function handleSelectTemplate(templateId: string) {
    await persistActiveTemplate(activeTemplateName, activeTemplateMarkdown);
    const nextTemplate = noteTemplates.find((template) => template.id === templateId);
    if (!nextTemplate) {
      return;
    }

    setSelectedTemplateId(nextTemplate.id);
    setActiveTemplateName(nextTemplate.name);
    setActiveTemplateMarkdown(nextTemplate.markdown);
    setTemplateMobileView('editor');
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

  function handleStartDeletionTargetSelection() {
    setDeletionTargetNoteIds([]);
    setIsDeletionTargetSelectionMode(true);
  }

  function handleToggleDeletionTarget(noteId: string) {
    setDeletionTargetNoteIds((currentIds) =>
      currentIds.includes(noteId)
        ? currentIds.filter((currentId) => currentId !== noteId)
        : [...currentIds, noteId]
    );
  }

  function handleCancelDeletionTargetSelection() {
    setDeletionTargetNoteIds([]);
    setIsDeletionTargetSelectionMode(false);
  }

  async function handleDeleteDeletionTargets() {
    if (deletionTargetNoteIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `選択した${deletionTargetNoteIds.length}件のNoteは削除され、復元できません。削除しますか？`
    );
    if (!confirmed) {
      return;
    }

    const deletionTargetSet = new Set(deletionTargetNoteIds);
    const deletesOpenNote = selectedNote ? deletionTargetSet.has(selectedNote.id) : false;
    const remainingNotes = sortNotesByUpdatedTime(
      notes.filter((note) => !deletionTargetSet.has(note.id))
    );
    const fallbackNote = remainingNotes.length === 0 ? createNote() : null;

    if (!deletesOpenNote) {
      const saved = await persistActiveNote(activeMarkdown);
      if (!saved) {
        return;
      }
    }

    try {
      await deleteNotes(deletionTargetNoteIds);

      if (fallbackNote) {
        await putNote(fallbackNote);
      }

      const nextNotes = fallbackNote ? [fallbackNote] : remainingNotes;
      setNotes((currentNotes) => {
        const nextCurrentNotes = sortNotesByUpdatedTime(
          currentNotes.filter((note) => !deletionTargetSet.has(note.id))
        );
        return nextCurrentNotes.length > 0 ? nextCurrentNotes : nextNotes;
      });

      const nextOpenNote = deletesOpenNote ? nextNotes[0] : selectedNote;
      setSelectedNoteId(nextOpenNote?.id ?? null);
      setActiveMarkdown(nextOpenNote?.markdown ?? '');
      setDeletionTargetNoteIds([]);
      setIsDeletionTargetSelectionMode(false);
      setMobileView('list');
      setStorageError(null);
    } catch (error) {
      setStorageError(getStorageErrorMessage(error));
    }
  }

  async function handleDuplicateNote() {
    if (!selectedNote) {
      return;
    }

    const latestSource: Note = {
      ...selectedNote,
      markdown: activeMarkdown
    };
    const saved = await persistActiveNote(activeMarkdown);
    if (!saved) {
      return;
    }

    const note = duplicateNote(latestSource);
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

  async function handleDeleteTemplate() {
    if (!selectedTemplate) {
      return;
    }

    const confirmed = window.confirm('このテンプレートは削除され、復元できません。削除しますか？');
    if (!confirmed) {
      return;
    }

    try {
      await deleteNoteTemplate(selectedTemplate.id);
      const remainingTemplates = sortNoteTemplatesByName(
        noteTemplates.filter((template) => template.id !== selectedTemplate.id)
      );
      setNoteTemplates(remainingTemplates);
      setSelectedTemplateId(remainingTemplates[0]?.id ?? null);
      setActiveTemplateName(remainingTemplates[0]?.name ?? '');
      setActiveTemplateMarkdown(remainingTemplates[0]?.markdown ?? '');
      setTemplateMobileView('list');
      setStorageError(null);
    } catch (error) {
      setStorageError(getStorageErrorMessage(error));
    }
  }

  async function handleCreateNoteFromTemplate(templateId: string) {
    await persistActiveTemplate(activeTemplateName, activeTemplateMarkdown);
    await persistActiveNote(activeMarkdown);

    const storedTemplate = noteTemplates.find((item) => item.id === templateId);
    const template =
      storedTemplate && storedTemplate.id === selectedTemplateId
        ? {
            ...storedTemplate,
            name: activeTemplateName,
            markdown: activeTemplateMarkdown
          }
        : storedTemplate;
    if (!template) {
      return;
    }

    const note = createNote(template.markdown);
    setNotes((currentNotes) => sortNotesByUpdatedTime([note, ...currentNotes]));
    setSelectedNoteId(note.id);
    setActiveMarkdown(note.markdown);
    setAppView('notes');
    setMobileView('editor');

    try {
      await putNote(note);
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

  function openTemplateManagement() {
    setTemplateMobileView('list');
    setAppView('templates');
  }

  if (appView === 'templates') {
    return (
      <TemplateManager
        templates={noteTemplates.map((template) =>
          template.id === selectedTemplateId
            ? { ...template, name: activeTemplateName, markdown: activeTemplateMarkdown }
            : template
        )}
        selectedTemplateId={selectedTemplateId}
        mobileView={templateMobileView}
        sidebarWidth={sidebarWidth}
        isSmallScreen={isSmallScreen}
        canToggleListNav={canToggleListNav}
        isListNavCollapsed={effectiveListNavCollapsed}
        isListNavPeeking={isListNavPeeking}
        isResizingSidebar={isResizingSidebar}
        listNavRef={setListNavElementRef}
        storageError={storageError}
        onCreateTemplate={handleCreateTemplate}
        onSelectTemplate={handleSelectTemplate}
        onChangeTemplateName={handleTemplateNameChange}
        onChangeTemplateMarkdown={handleTemplateMarkdownChange}
        onFlush={() => void persistActiveTemplate(activeTemplateName, activeTemplateMarkdown)}
        onDeleteTemplate={handleDeleteTemplate}
        onCreateNoteFromTemplate={handleCreateNoteFromTemplate}
        onResizePointerDown={handleResizePointerDown}
        onResizeKeyDown={(direction) =>
          commitSidebarWidth(sidebarWidth + (direction === 'wider' ? 16 : -16))
        }
        onBackToNotes={() => {
          void persistActiveTemplate(activeTemplateName, activeTemplateMarkdown);
          setAppView('notes');
          setMobileView('list');
        }}
        onBackToTemplateList={() => {
          void persistActiveTemplate(activeTemplateName, activeTemplateMarkdown);
          setTemplateMobileView('list');
        }}
        onToggleListNav={toggleListNav}
        onPeekListNav={() => setIsListNavPeeking(true)}
        onHideListNavPeek={() => setIsListNavPeeking(false)}
      />
    );
  }

  return (
    <div
      ref={shellRef}
      className={`app-shell app-shell--${mobileView}${effectiveListNavCollapsed ? ' app-shell--list-nav-collapsed' : ''}${isListNavPeeking ? ' app-shell--list-nav-peeking' : ''}${isResizingSidebar ? ' app-shell--resizing' : ''}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      {canToggleListNav && effectiveListNavCollapsed ? (
        <div
          className="list-nav-peek-zone"
          aria-hidden="true"
          onMouseEnter={() => setIsListNavPeeking(true)}
        />
      ) : null}
      <NoteList
        notes={visibleNotes}
        selectedNoteId={selectedNoteId}
        deletionTargetNoteIds={deletionTargetNoteIds}
        isDeletionTargetSelectionMode={isDeletionTargetSelectionMode}
        query={query}
        canToggleListNav={canToggleListNav}
        isListNavCollapsed={effectiveListNavCollapsed}
        listNavRef={setListNavElementRef}
        onQueryChange={handleQueryChange}
        onCreateNote={handleCreateNote}
        onSelectNote={handleSelectNote}
        onStartDeletionTargetSelection={handleStartDeletionTargetSelection}
        onToggleDeletionTarget={handleToggleDeletionTarget}
        onDeleteDeletionTargets={handleDeleteDeletionTargets}
        onCancelDeletionTargetSelection={handleCancelDeletionTargetSelection}
        onOpenTemplateManagement={openTemplateManagement}
        onToggleListNav={toggleListNav}
        onHideListNavPeek={() => setIsListNavPeeking(false)}
      />
      {canToggleListNav && !effectiveListNavCollapsed ? (
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
      ) : null}
      <EditorPane
        note={selectedNote}
        markdown={activeMarkdown}
        updatedAt={selectedNote?.updatedAt ?? null}
        applicableTemplates={applicableTemplates}
        storageError={storageError}
        appUpdateAvailable={isInstalledPwa && needRefresh}
        isApplyingAppUpdate={isApplyingAppUpdate}
        onMarkdownChange={handleMarkdownChange}
        onFlush={() => void persistActiveNote(activeMarkdown)}
        onApplyAppUpdate={handleApplyAppUpdate}
        onDuplicateNote={handleDuplicateNote}
        onDeleteNote={handleDeleteNote}
        onOpenTemplateManagement={openTemplateManagement}
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

  function toggleListNav() {
    if (isSmallScreen) {
      return;
    }

    setIsListNavCollapsed((currentValue) => {
      const nextValue = !currentValue;
      window.localStorage.setItem(listNavCollapsedStorageKey, String(nextValue));
      setIsListNavPeeking(false);
      return nextValue;
    });
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

function loadListNavCollapsed(): boolean {
  return window.localStorage.getItem(listNavCollapsedStorageKey) === 'true';
}

function matchesSmallScreen(): boolean {
  return window.matchMedia(smallScreenMediaQuery).matches;
}

function isRunningAsInstalledPwa(): boolean {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    standaloneNavigator.standalone === true
  );
}
