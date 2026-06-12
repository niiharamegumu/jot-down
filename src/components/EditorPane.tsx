import {
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods
} from '@mdxeditor/editor';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type MouseEvent as ReactMouseEvent
} from 'react';
import type { Note } from '../domain/note';
import {
  getNoteLineMovementTargetRange,
  moveNoteLines,
  normalizeSupportedMarkdown,
  toggleTaskAtIndex,
  type NoteLineMovement
} from '../domain/note';
import type { NoteTemplate } from '../domain/noteTemplate';
import {
  captureNoteLineRangeSelectionSnapshot,
  getSelectedNoteLineRange,
  restoreNoteLineSelectionSnapshot,
  type NoteLineSelectionSnapshot
} from './editorLineSelection';
import {
  addEditorOnlyListBoundaries,
  removeEditorOnlyListBoundaries
} from './editorMarkdownBoundaries';
import { syncNormalizedEditorMarkdown as syncNormalizedMarkdownFromEditor } from './editorMarkdownSync';
import { installMdxEditorFloatingUiFixes, isMdxEditorFloatingUiElement } from './editorFloatingUi';
import { openLinkFromCommandClick } from './editorLinkInteraction';
import {
  captureTaskSelectionSnapshot,
  restoreTaskSelectionSnapshot,
  type TaskSelectionSnapshot
} from './editorTaskSelection';
import { isTaskCheckboxHit, mdxEditorSelectionPlugin } from './mdxEditorSelectionPlugin';

type EditorPaneProps = {
  note: Note | null;
  markdown: string;
  updatedAt: string | null;
  applicableTemplates: NoteTemplate[];
  storageError: string | null;
  appUpdateAvailable: boolean;
  isApplyingAppUpdate: boolean;
  copyStatus: 'idle' | 'copied' | 'failed';
  pendingTemplateInsertion: { requestId: number; markdown: string } | null;
  onMarkdownChange: (markdown: string) => void;
  onFlush: () => void;
  onApplyAppUpdate: () => void;
  onDuplicateNote: () => void;
  onDeleteNote: () => void;
  onCopyMarkdown: () => void;
  onOpenTemplateManagement: () => void;
  onBackToList: () => void;
  onTemplateInsertionHandled: (requestId: number) => void;
};

const editorPlugins = [
  headingsPlugin(),
  listsPlugin(),
  mdxEditorSelectionPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  markdownShortcutPlugin()
];
const updatedAtFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export function EditorPane({
  note,
  markdown,
  updatedAt,
  applicableTemplates,
  storageError,
  appUpdateAvailable,
  isApplyingAppUpdate,
  copyStatus,
  pendingTemplateInsertion,
  onMarkdownChange,
  onFlush,
  onApplyAppUpdate,
  onDuplicateNote,
  onDeleteNote,
  onCopyMarkdown,
  onOpenTemplateManagement,
  onBackToList,
  onTemplateInsertionHandled
}: EditorPaneProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const editorShellRef = useRef<HTMLElement>(null);
  const previousNoteIdRef = useRef<string | null>(null);
  const currentNoteIdRef = useRef<string | null>(null);
  const pendingProgrammaticMarkdownRef = useRef<string | null>(null);
  const pendingNoteLineSelectionRef = useRef<NoteLineSelectionSnapshot | null>(null);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  useLayoutEffect(() => {
    currentNoteIdRef.current = note?.id ?? null;
  }, [note?.id]);

  useEffect(() => installMdxEditorFloatingUiFixes(), []);

  useEffect(() => {
    if (!pendingTemplateInsertion) {
      return;
    }

    handleInsertTemplate(pendingTemplateInsertion.markdown);
    onTemplateInsertionHandled(pendingTemplateInsertion.requestId);
  }, [pendingTemplateInsertion, onTemplateInsertionHandled]);

  useEffect(() => {
    const snapshot = pendingNoteLineSelectionRef.current;
    if (!snapshot || snapshot.noteId !== note?.id || snapshot.markdown !== markdown) {
      return;
    }

    scheduleNoteLineSelectionRestore(snapshot);
  }, [markdown, note?.id]);

  useEffect(() => {
    if (!note) {
      return;
    }

    const editorShell = editorShellRef.current;
    if (!editorShell) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => handleEditorShortcut(event);
    editorShell.addEventListener('keydown', handleKeyDown, true);
    return () => editorShell.removeEventListener('keydown', handleKeyDown, true);
  });

  useEffect(() => {
    if (!note) {
      previousNoteIdRef.current = null;
      pendingNoteLineSelectionRef.current = null;
      return;
    }

    if (previousNoteIdRef.current !== note.id) {
      pendingNoteLineSelectionRef.current = null;
      pendingProgrammaticMarkdownRef.current = markdown;
      editorRef.current?.setMarkdown(toEditorMarkdown(markdown));
      previousNoteIdRef.current = note.id;
      window.requestAnimationFrame(() => {
        if (shouldSkipEditorAutoFocus()) {
          return;
        }

        editorRef.current?.focus(undefined, { defaultSelection: 'rootStart' });
      });
    }
  }, [markdown, note]);

  if (!note) {
    return (
      <main className="editor-pane editor-pane--empty">
        <p>Local note storeを準備しています。</p>
      </main>
    );
  }

  const activeNoteId = note.id;

  return (
    <main className="editor-pane" aria-label="選択中のNote">
      <header className="editor-toolbar">
        <button
          className="back-button"
          type="button"
          onClick={onBackToList}
          aria-label="Note一覧へ戻る"
          data-tooltip="Note一覧へ戻る"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <p className="editor-toolbar__updated-at">
          {updatedAt ? updatedAtFormatter.format(new Date(updatedAt)) : ''}
        </p>
        <button
          className="icon-button copy-markdown-button"
          type="button"
          onClick={onCopyMarkdown}
          aria-label="Note Markdownをコピー"
          data-tooltip="Note Markdownをコピー"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M9 5h6" />
            <path d="M10 3h4a1 1 0 0 1 1 1v2H9V4a1 1 0 0 1 1-1z" />
            <path d="M7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1" />
            <path d="M8 12h8" />
            <path d="M8 16h6" />
          </svg>
        </button>
        <button
          className="icon-button duplicate-button"
          type="button"
          onClick={onDuplicateNote}
          aria-label="Noteを複製"
          data-tooltip="Noteを複製"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M8 8h10v12H8z" />
            <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <div className="template-insert">
          <button
            className="icon-button"
            type="button"
            aria-label="テンプレートを挿入"
            data-tooltip="テンプレートを挿入"
            onClick={() => setTemplateMenuOpen((open) => !open)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M6 3h9l3 3v15H6z" />
              <path d="M15 3v4h4" />
              <path d="M9 12h6" />
              <path d="M9 16h4" />
            </svg>
          </button>
          {templateMenuOpen ? (
            <div className="template-popover">
              {applicableTemplates.length > 0 ? (
                applicableTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleInsertTemplate(template.markdown)}
                  >
                    {template.name}
                  </button>
                ))
              ) : (
                <button type="button" onClick={handleOpenTemplateManagement}>
                  テンプレートを作成
                </button>
              )}
            </div>
          ) : null}
        </div>
        <button
          className="delete-button"
          type="button"
          onClick={onDeleteNote}
          aria-label="Noteを削除"
          data-tooltip="Noteを削除"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M6 6l1 15h10l1-15" />
            <path d="M10 10v7" />
            <path d="M14 10v7" />
          </svg>
        </button>
      </header>

      {storageError ? (
        <div className="storage-error" role="alert">
          <strong>保存できません。</strong>
          <span>{storageError}</span>
        </div>
      ) : null}

      <p className="copy-status" role="status" aria-live="polite">
        {copyStatus === 'copied' ? 'コピーしました' : ''}
        {copyStatus === 'failed' ? 'コピーできませんでした' : ''}
      </p>

      {appUpdateAvailable ? (
        <div className="app-update" role="status">
          <span>新しいバージョンがあります。</span>
          <button type="button" onClick={onApplyAppUpdate} disabled={isApplyingAppUpdate}>
            {isApplyingAppUpdate ? '更新中...' : '更新'}
          </button>
        </div>
      ) : null}

      <section
        ref={editorShellRef}
        className="editor-shell"
        onBlurCapture={handleEditorBlur}
        onClickCapture={handleEditorClick}
        onPasteCapture={handleEditorPaste}
      >
        <MDXEditor
          ref={editorRef}
          markdown={toEditorMarkdown(markdown)}
          onChange={handleMarkdownChange}
          plugins={editorPlugins}
          contentEditableClassName="jot-editor"
        />
      </section>
    </main>
  );

  function handleEditorClick(event: ReactMouseEvent<HTMLElement>) {
    if (openLinkFromCommandClick(event)) {
      return;
    }

    const target = event.target instanceof HTMLElement ? event.target : null;
    const checkbox = target?.closest('[role="checkbox"][aria-checked]');
    if (!(checkbox instanceof HTMLElement)) {
      return;
    }

    if (!isTaskCheckboxHit(checkbox, event.clientX)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const taskIndex = getTaskIndex(checkbox);
    if (taskIndex >= 0) {
      toggleTask(taskIndex);
    }
  }

  function handleEditorShortcut(event: globalThis.KeyboardEvent) {
    if (event.altKey && !event.metaKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      moveSelectedNoteLine(event, getNoteLineMovementForShortcut(event));
      return;
    }

    if (!event.metaKey || event.altKey || event.key !== 'Enter') {
      return;
    }

    const editorShell = editorShellRef.current;
    if (!editorShell) {
      return;
    }

    const checkbox = getSelectedTaskCheckbox(editorShell, event.target);
    if (!checkbox) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const taskIndex = getTaskIndex(checkbox);
    if (taskIndex >= 0) {
      toggleTask(taskIndex, captureTaskSelectionSnapshot(activeNoteId, taskIndex, checkbox));
    }
  }

  function getSelectedTaskCheckbox(
    root: HTMLElement,
    eventTarget: EventTarget | null
  ): HTMLElement | null {
    const selection = window.getSelection();
    const selectedNode = selection?.anchorNode;
    if (selectedNode && root.contains(selectedNode)) {
      const selectedElement =
        selectedNode instanceof HTMLElement ? selectedNode : selectedNode.parentElement;
      const checkbox = selectedElement?.closest('[role="checkbox"][aria-checked]');
      if (checkbox instanceof HTMLElement && root.contains(checkbox)) {
        return checkbox;
      }
    }

    const target = eventTarget instanceof HTMLElement ? eventTarget : null;
    const targetCheckbox = target?.closest('[role="checkbox"][aria-checked]');
    return targetCheckbox instanceof HTMLElement && root.contains(targetCheckbox)
      ? targetCheckbox
      : null;
  }

  function getTaskIndex(checkbox: HTMLElement): number {
    const checkboxes = Array.from(
      editorShellRef.current?.querySelectorAll('[role="checkbox"][aria-checked]') ?? []
    );
    return checkboxes.indexOf(checkbox);
  }

  function getNoteLineMovementForShortcut(event: globalThis.KeyboardEvent): NoteLineMovement {
    if (event.key === 'ArrowUp') {
      return event.ctrlKey ? 'start' : 'up';
    }

    return event.ctrlKey ? 'end' : 'down';
  }

  function toggleTask(taskIndex: number, selectionSnapshot: TaskSelectionSnapshot | null = null) {
    const nextMarkdown = normalizeSupportedMarkdown(toggleTaskAtIndex(markdown, taskIndex));
    applyProgrammaticMarkdownChange(nextMarkdown);

    if (selectionSnapshot) {
      window.requestAnimationFrame(() => restoreTaskSelection(selectionSnapshot));
    }
  }

  function moveSelectedNoteLine(event: globalThis.KeyboardEvent, movement: NoteLineMovement) {
    const editorRoot = getEditorRoot();
    if (!editorRoot) {
      return;
    }

    const currentMarkdown = markdown;
    const lineRange = getSelectedNoteLineRange(editorRoot, currentMarkdown);
    if (!lineRange) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const targetLineRange = getNoteLineMovementTargetRange(currentMarkdown, lineRange, movement);
    if (!targetLineRange) {
      return;
    }

    const nextMarkdown = moveNoteLines(currentMarkdown, lineRange, movement);
    if (nextMarkdown === currentMarkdown) {
      const selectionSnapshot = captureNoteLineRangeSelectionSnapshot(
        activeNoteId,
        targetLineRange,
        editorRoot,
        nextMarkdown
      );

      if (selectionSnapshot) {
        scheduleNoteLineSelectionRestore(
          withSelectionRevealForJumpMovement(selectionSnapshot, movement)
        );
      }

      return;
    }

    const selectionSnapshot = captureNoteLineRangeSelectionSnapshot(
      activeNoteId,
      targetLineRange,
      editorRoot,
      nextMarkdown
    );

    if (selectionSnapshot) {
      pendingNoteLineSelectionRef.current = withSelectionRevealForJumpMovement(
        selectionSnapshot,
        movement
      );
    }

    applyProgrammaticMarkdownChange(nextMarkdown);
  }

  function handleMarkdownChange(nextMarkdown: string) {
    const appMarkdown = fromEditorMarkdown(nextMarkdown);
    if (
      shouldIgnorePendingProgrammaticMarkdown(appMarkdown) ||
      isEditorListNormalization(markdown, appMarkdown)
    ) {
      return;
    }

    if (appMarkdown === markdown) {
      pendingProgrammaticMarkdownRef.current = null;
      return;
    }

    onMarkdownChange(normalizeSupportedMarkdown(appMarkdown));
  }

  function handleEditorBlur(event: FocusEvent<HTMLElement>) {
    if (isMdxEditorFloatingUiElement(event.relatedTarget)) {
      return;
    }

    syncNormalizedEditorMarkdown({ restoreSelection: false });
    onFlush();
  }

  function handleEditorPaste(event: ClipboardEvent<HTMLElement>) {
    const pastedText = event.clipboardData.getData('text/plain');
    if (pastedText) {
      event.preventDefault();
      event.stopPropagation();
      const normalizedPastedText = normalizeSupportedMarkdown(pastedText);

      if (markdown.trim() === '') {
        applyProgrammaticMarkdownChange(normalizedPastedText);
        return;
      }

      editorRef.current?.focus(() => {
        editorRef.current?.insertMarkdown(normalizedPastedText);
        onMarkdownChange(
          normalizeSupportedMarkdown(
            fromEditorMarkdown(editorRef.current?.getMarkdown() ?? markdown)
          )
        );
      });
      return;
    }

    window.requestAnimationFrame(() => syncNormalizedEditorMarkdown());
  }

  function syncNormalizedEditorMarkdown({ restoreSelection = true } = {}) {
    const currentMarkdown = fromEditorMarkdown(editorRef.current?.getMarkdown() ?? markdown);
    if (
      shouldIgnorePendingProgrammaticMarkdown(currentMarkdown) ||
      isEditorListNormalization(markdown, currentMarkdown)
    ) {
      return;
    }

    const editorAdapter = editorRef.current
      ? ({
          getMarkdown: () => currentMarkdown,
          setMarkdown: (nextMarkdown: string) =>
            editorRef.current?.setMarkdown(toEditorMarkdown(nextMarkdown))
        } as Parameters<typeof syncNormalizedMarkdownFromEditor>[0])
      : null;

    syncNormalizedMarkdownFromEditor(editorAdapter, markdown, onMarkdownChange, getEditorRoot(), {
      restoreSelection
    });
  }

  function handleInsertTemplate(templateMarkdown: string) {
    editorRef.current?.focus(() => {
      editorRef.current?.insertMarkdown(templateMarkdown);
      onMarkdownChange(
        normalizeSupportedMarkdown(fromEditorMarkdown(editorRef.current?.getMarkdown() ?? markdown))
      );
    });
    setTemplateMenuOpen(false);
  }

  function handleOpenTemplateManagement() {
    setTemplateMenuOpen(false);
    onOpenTemplateManagement();
  }

  function getEditorRoot(): HTMLElement | null {
    const editor = editorShellRef.current?.querySelector('[contenteditable="true"]');
    return editor instanceof HTMLElement ? editor : null;
  }

  function restoreTaskSelection(snapshot: TaskSelectionSnapshot) {
    const checkbox = editorShellRef.current?.querySelectorAll('[role="checkbox"][aria-checked]')[
      snapshot.taskIndex
    ];
    restoreTaskSelectionSnapshot(
      snapshot,
      () => currentNoteIdRef.current,
      checkbox instanceof HTMLElement ? checkbox : null
    );
  }

  function restoreNoteLineSelection(snapshot: NoteLineSelectionSnapshot): boolean {
    return restoreNoteLineSelectionSnapshot(
      snapshot,
      () => currentNoteIdRef.current,
      getEditorRoot()
    );
  }

  function withSelectionRevealForJumpMovement(
    snapshot: NoteLineSelectionSnapshot,
    movement: NoteLineMovement
  ): NoteLineSelectionSnapshot {
    if (movement !== 'start' && movement !== 'end') {
      return snapshot;
    }

    return { ...snapshot, revealSelection: true };
  }

  function scheduleNoteLineSelectionRestore(
    snapshot: NoteLineSelectionSnapshot,
    attemptsRemaining = 4,
    stabilizationFramesRemaining = 2
  ) {
    window.requestAnimationFrame(() => {
      if (pendingNoteLineSelectionRef.current && pendingNoteLineSelectionRef.current !== snapshot) {
        return;
      }

      const restored = restoreNoteLineSelection(snapshot);
      if (restored) {
        if (pendingNoteLineSelectionRef.current === snapshot) {
          if (stabilizationFramesRemaining > 0) {
            scheduleNoteLineSelectionRestore(snapshot, 0, stabilizationFramesRemaining - 1);
            return;
          }

          pendingNoteLineSelectionRef.current = null;
        }
        return;
      }

      if (attemptsRemaining > 0) {
        scheduleNoteLineSelectionRestore(snapshot, attemptsRemaining - 1);
      }
    });
  }

  function applyProgrammaticMarkdownChange(nextMarkdown: string) {
    pendingProgrammaticMarkdownRef.current = nextMarkdown;
    editorRef.current?.setMarkdown(toEditorMarkdown(nextMarkdown));
    onMarkdownChange(nextMarkdown);
  }

  function shouldIgnorePendingProgrammaticMarkdown(nextMarkdown: string): boolean {
    const pendingProgrammaticMarkdown = pendingProgrammaticMarkdownRef.current;
    if (!pendingProgrammaticMarkdown) {
      return false;
    }

    if (isProgrammaticEditorListNormalization(pendingProgrammaticMarkdown, nextMarkdown)) {
      pendingProgrammaticMarkdownRef.current = null;
      return true;
    }

    pendingProgrammaticMarkdownRef.current = null;
    return false;
  }

  function isEditorListNormalization(sourceMarkdown: string, nextMarkdown: string): boolean {
    return isChecklistNormalization(sourceMarkdown, nextMarkdown);
  }

  function isProgrammaticEditorListNormalization(
    sourceMarkdown: string,
    nextMarkdown: string
  ): boolean {
    return (
      isChecklistNormalization(sourceMarkdown, nextMarkdown) ||
      isListStructureFlattening(sourceMarkdown, nextMarkdown)
    );
  }

  function isChecklistNormalization(sourceMarkdown: string, nextMarkdown: string): boolean {
    if (
      nextMarkdown === sourceMarkdown ||
      !hasSameReadableNoteLines(sourceMarkdown, nextMarkdown)
    ) {
      return false;
    }

    const sourceLines = getNonBlankNoteLines(sourceMarkdown);
    const nextLines = getNonBlankNoteLines(nextMarkdown);
    return (
      sourceLines.length === nextLines.length &&
      sourceLines.every(isMarkdownListLine) &&
      nextLines.every(isMarkdownTaskLine)
    );
  }

  function isListStructureFlattening(sourceMarkdown: string, nextMarkdown: string): boolean {
    if (
      nextMarkdown === sourceMarkdown ||
      !hasSameReadableNoteLines(sourceMarkdown, nextMarkdown)
    ) {
      return false;
    }

    const sourceLines = getNonBlankNoteLines(sourceMarkdown);
    const nextLines = getNonBlankNoteLines(nextMarkdown);
    return (
      sourceLines.length === nextLines.length &&
      sourceLines.every(isMarkdownListLine) &&
      nextLines.every(isMarkdownListLine) &&
      sourceLines.some(
        (line, index) =>
          getMarkdownLineIndentLength(line) > getMarkdownLineIndentLength(nextLines[index])
      ) &&
      nextLines.every(
        (line, index) =>
          getMarkdownLineIndentLength(line) <= getMarkdownLineIndentLength(sourceLines[index])
      )
    );
  }

  function hasSameReadableNoteLines(left: string, right: string): boolean {
    const leftLines = getReadableNoteLines(left);
    const rightLines = getReadableNoteLines(right);
    return (
      leftLines.length === rightLines.length &&
      leftLines.every((line, index) => line === rightLines[index])
    );
  }

  function getReadableNoteLines(value: string): string[] {
    return getNonBlankNoteLines(value).map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, '')
        .replace(/^\s*[-*]\s+\[(?: |x|X)\]\s+/, '')
        .replace(/^\s*[-*]\s+/, '')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  function getNonBlankNoteLines(value: string): string[] {
    return value.split(/\r?\n/).filter((line) => line.trim() !== '');
  }

  function isMarkdownListLine(line: string): boolean {
    return /^\s*[-*]\s+/.test(line);
  }

  function isMarkdownTaskLine(line: string): boolean {
    return /^\s*[-*]\s+\[(?: |x|X)\]\s+/.test(line);
  }

  function getMarkdownLineIndentLength(line: string): number {
    return line.match(/^\s*/)?.[0].length ?? 0;
  }

  function toEditorMarkdown(value: string): string {
    return addEditorOnlyListBoundaries(value);
  }

  function fromEditorMarkdown(value: string): string {
    return removeEditorOnlyListBoundaries(value);
  }

  function shouldSkipEditorAutoFocus(): boolean {
    const activeElement = document.activeElement;
    if (
      !activeElement ||
      activeElement === document.body ||
      activeElement === document.documentElement
    ) {
      return false;
    }

    if (editorShellRef.current?.contains(activeElement)) {
      return false;
    }

    return isEditableElement(activeElement);
  }
}

function isEditableElement(element: Element): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.getAttribute('contenteditable') === 'true' ||
    element.closest('[contenteditable="true"]') !== null
  );
}
