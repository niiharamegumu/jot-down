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
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from 'react';
import type { Note } from '../domain/note';
import { normalizeSupportedMarkdown, toggleTaskAtIndex } from '../domain/note';
import type { NoteTemplate } from '../domain/noteTemplate';
import { syncNormalizedEditorMarkdown as syncNormalizedMarkdownFromEditor } from './editorMarkdownSync';
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
  onMarkdownChange: (markdown: string) => void;
  onFlush: () => void;
  onApplyAppUpdate: () => void;
  onDuplicateNote: () => void;
  onDeleteNote: () => void;
  onOpenTemplateManagement: () => void;
  onBackToList: () => void;
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
  onMarkdownChange,
  onFlush,
  onApplyAppUpdate,
  onDuplicateNote,
  onDeleteNote,
  onOpenTemplateManagement,
  onBackToList
}: EditorPaneProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const editorShellRef = useRef<HTMLElement>(null);
  const previousNoteIdRef = useRef<string | null>(null);
  const currentNoteIdRef = useRef<string | null>(null);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  useLayoutEffect(() => {
    currentNoteIdRef.current = note?.id ?? null;
  }, [note?.id]);

  useEffect(() => {
    if (!note) {
      previousNoteIdRef.current = null;
      return;
    }

    if (previousNoteIdRef.current !== note.id) {
      editorRef.current?.setMarkdown(markdown);
      previousNoteIdRef.current = note.id;
      window.requestAnimationFrame(() =>
        editorRef.current?.focus(undefined, { defaultSelection: 'rootStart' })
      );
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
        onClickCapture={handleTaskClick}
        onKeyDownCapture={handleTaskShortcut}
        onPasteCapture={handleEditorPaste}
      >
        <MDXEditor
          ref={editorRef}
          markdown={markdown}
          onChange={handleMarkdownChange}
          plugins={editorPlugins}
          contentEditableClassName="jot-editor"
        />
      </section>
    </main>
  );

  function handleTaskClick(event: ReactMouseEvent<HTMLElement>) {
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

  function handleTaskShortcut(event: KeyboardEvent<HTMLElement>) {
    if (!event.metaKey || event.key !== 'Enter') {
      return;
    }

    const checkbox = getSelectedTaskCheckbox(event.currentTarget, event.target);
    if (!checkbox) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

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

  function toggleTask(taskIndex: number, selectionSnapshot: TaskSelectionSnapshot | null = null) {
    const nextMarkdown = normalizeSupportedMarkdown(toggleTaskAtIndex(markdown, taskIndex));
    editorRef.current?.setMarkdown(nextMarkdown);
    onMarkdownChange(nextMarkdown);

    if (selectionSnapshot) {
      window.requestAnimationFrame(() => restoreTaskSelection(selectionSnapshot));
    }
  }

  function handleMarkdownChange(nextMarkdown: string) {
    onMarkdownChange(normalizeSupportedMarkdown(nextMarkdown));
  }

  function handleEditorBlur() {
    syncNormalizedEditorMarkdown();
    onFlush();
  }

  function handleEditorPaste() {
    window.requestAnimationFrame(syncNormalizedEditorMarkdown);
  }

  function syncNormalizedEditorMarkdown() {
    syncNormalizedMarkdownFromEditor(
      editorRef.current,
      markdown,
      onMarkdownChange,
      getEditorRoot()
    );
  }

  function handleInsertTemplate(templateMarkdown: string) {
    editorRef.current?.focus(() => {
      editorRef.current?.insertMarkdown(templateMarkdown);
      onMarkdownChange(normalizeSupportedMarkdown(editorRef.current?.getMarkdown() ?? markdown));
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
}
