import {
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods
} from '@mdxeditor/editor';
import { useEffect, useRef, type MouseEvent } from 'react';
import type { Note } from '../domain/note';
import { normalizeSupportedMarkdown, toggleTaskAtIndex } from '../domain/note';

type EditorPaneProps = {
  note: Note | null;
  markdown: string;
  updatedAt: string | null;
  storageError: string | null;
  appUpdateAvailable: boolean;
  isApplyingAppUpdate: boolean;
  onMarkdownChange: (markdown: string) => void;
  onFlush: () => void;
  onApplyAppUpdate: () => void;
  onDeleteNote: () => void;
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
  storageError,
  appUpdateAvailable,
  isApplyingAppUpdate,
  onMarkdownChange,
  onFlush,
  onApplyAppUpdate,
  onDeleteNote,
  onBackToList
}: EditorPaneProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const editorShellRef = useRef<HTMLElement>(null);
  const previousNoteIdRef = useRef<string | null>(null);

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
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <p className="editor-toolbar__updated-at">
          {updatedAt ? updatedAtFormatter.format(new Date(updatedAt)) : ''}
        </p>
        <button
          className="delete-button"
          type="button"
          onClick={onDeleteNote}
          aria-label="Noteを削除"
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
        onClickCapture={handleEditorClick}
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

  function handleEditorClick(event: MouseEvent<HTMLElement>) {
    if (openClickedLink(event)) {
      return;
    }

    handleTaskClick(event);
  }

  function openClickedLink(event: MouseEvent<HTMLElement>): boolean {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const link = target?.closest('a[href]');
    if (!(link instanceof HTMLAnchorElement)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    window.open(link.href, '_blank', 'noopener,noreferrer');
    return true;
  }

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

    const checkboxes = Array.from(
      event.currentTarget.querySelectorAll('[role="checkbox"][aria-checked]')
    );
    const taskIndex = checkboxes.indexOf(checkbox);
    if (taskIndex < 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const nextMarkdown = normalizeSupportedMarkdown(toggleTaskAtIndex(markdown, taskIndex));
    editorRef.current?.setMarkdown(nextMarkdown);
    onMarkdownChange(nextMarkdown);
  }

  function handleMarkdownChange(nextMarkdown: string) {
    onMarkdownChange(normalizeSupportedMarkdown(nextMarkdown));
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
