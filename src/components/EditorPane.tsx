import {
  headingsPlugin,
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
  onMarkdownChange: (markdown: string) => void;
  onFlush: () => void;
  onDeleteNote: () => void;
  onBackToList: () => void;
};

const editorPlugins = [headingsPlugin(), listsPlugin(), markdownShortcutPlugin()];
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
  onMarkdownChange,
  onFlush,
  onDeleteNote,
  onBackToList
}: EditorPaneProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const previousNoteIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!note) {
      previousNoteIdRef.current = null;
      return;
    }

    if (previousNoteIdRef.current !== note.id) {
      editorRef.current?.setMarkdown(markdown);
      previousNoteIdRef.current = note.id;
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
        <button className="back-button" type="button" onClick={onBackToList} aria-label="Note一覧へ戻る">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <p className="editor-toolbar__updated-at">
          {updatedAt ? updatedAtFormatter.format(new Date(updatedAt)) : ''}
        </p>
        <button className="delete-button" type="button" onClick={onDeleteNote} aria-label="Noteを削除">
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

      <section className="editor-shell" onBlurCapture={onFlush} onClickCapture={handleTaskClick}>
        <MDXEditor
          ref={editorRef}
          markdown={markdown}
          onChange={onMarkdownChange}
          plugins={editorPlugins}
          contentEditableClassName="jot-editor"
          placeholder="ここに書き始める"
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

    const checkboxes = Array.from(event.currentTarget.querySelectorAll('[role="checkbox"][aria-checked]'));
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
}
