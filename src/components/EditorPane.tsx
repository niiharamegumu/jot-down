import {
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods
} from '@mdxeditor/editor';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Note } from '../domain/note';
import { normalizeSupportedMarkdown, toggleTaskAtIndex } from '../domain/note';
import type { NoteTemplate } from '../domain/noteTemplate';

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
  onDeleteNote: () => void;
  onOpenTemplateManagement: () => void;
  onBackToList: () => void;
};

const editorPlugins = [
  headingsPlugin(),
  listsPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  markdownShortcutPlugin()
];
const taskCheckboxHitAreaWidthPx = 24;
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
  onDeleteNote,
  onOpenTemplateManagement,
  onBackToList
}: EditorPaneProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const editorShellRef = useRef<HTMLElement>(null);
  const previousNoteIdRef = useRef<string | null>(null);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  useEffect(() => {
    if (!note) {
      previousNoteIdRef.current = null;
      return;
    }

    if (previousNoteIdRef.current !== note.id) {
      editorRef.current?.setMarkdown(markdown);
      previousNoteIdRef.current = note.id;
      window.requestAnimationFrame(focusEditorStart);
    }
  }, [markdown, note]);

  if (!note) {
    return (
      <main className="editor-pane editor-pane--empty">
        <p>Local note storeを準備しています。</p>
      </main>
    );
  }

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
        onBlurCapture={onFlush}
        onClickCapture={handleTaskClick}
        onKeyDownCapture={handleTaskShortcut}
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

  function handleTaskClick(event: MouseEvent<HTMLElement>) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const checkbox = target?.closest('[role="checkbox"][aria-checked]');
    if (!(checkbox instanceof HTMLElement)) {
      return;
    }

    const checkboxRect = checkbox.getBoundingClientRect();
    const clickX = event.clientX - checkboxRect.left;
    if (clickX < 0 || clickX > taskCheckboxHitAreaWidthPx) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    toggleTask(checkbox);
  }

  function handleTaskShortcut(event: KeyboardEvent<HTMLElement>) {
    if (!event.metaKey || event.key !== 'Enter') {
      return;
    }

    const checkbox = getSelectedTaskCheckbox(event.currentTarget);
    if (!checkbox) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    toggleTask(checkbox);
  }

  function getSelectedTaskCheckbox(root: HTMLElement): HTMLElement | null {
    const selection = window.getSelection();
    const selectedNode = selection?.anchorNode;
    if (!selectedNode || !root.contains(selectedNode)) {
      return null;
    }

    const selectedElement =
      selectedNode instanceof HTMLElement ? selectedNode : selectedNode.parentElement;
    const checkbox = selectedElement?.closest('[role="checkbox"][aria-checked]');
    return checkbox instanceof HTMLElement && root.contains(checkbox) ? checkbox : null;
  }

  function toggleTask(checkbox: HTMLElement) {
    const checkboxes = Array.from(
      editorShellRef.current?.querySelectorAll('[role="checkbox"][aria-checked]') ?? []
    );
    const taskIndex = checkboxes.indexOf(checkbox);
    if (taskIndex < 0) {
      return;
    }

    const nextMarkdown = normalizeSupportedMarkdown(toggleTaskAtIndex(markdown, taskIndex));
    editorRef.current?.setMarkdown(nextMarkdown);
    onMarkdownChange(nextMarkdown);
  }

  function handleMarkdownChange(nextMarkdown: string) {
    onMarkdownChange(normalizeSupportedMarkdown(nextMarkdown));
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

  function focusEditorStart() {
    const editor = editorShellRef.current?.querySelector('[contenteditable="true"]');
    if (!(editor instanceof HTMLElement)) {
      return;
    }

    editor.focus();

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}
