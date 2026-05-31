import {
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods
} from '@mdxeditor/editor';
import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import {
  getNoteTemplateCompletion,
  sortNoteTemplatesByName,
  type NoteTemplate
} from '../domain/noteTemplate';
import { normalizeSupportedMarkdown } from '../domain/note';
import { syncNormalizedEditorMarkdown } from './editorMarkdownSync';

type TemplateManagerProps = {
  templates: NoteTemplate[];
  selectedTemplateId: string | null;
  sidebarWidth: number;
  isResizingSidebar: boolean;
  storageError: string | null;
  onCreateTemplate: () => void;
  onSelectTemplate: (templateId: string) => void;
  onChangeTemplateName: (name: string) => void;
  onChangeTemplateMarkdown: (markdown: string) => void;
  onFlush: () => void;
  onDeleteTemplate: () => void;
  onCreateNoteFromTemplate: (templateId: string) => void;
  onResizePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onResizeKeyDown: (direction: 'narrower' | 'wider') => void;
  onBackToNotes: () => void;
};

const editorPlugins = [
  headingsPlugin(),
  listsPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  markdownShortcutPlugin()
];

export function TemplateManager({
  templates,
  selectedTemplateId,
  sidebarWidth,
  isResizingSidebar,
  storageError,
  onCreateTemplate,
  onSelectTemplate,
  onChangeTemplateName,
  onChangeTemplateMarkdown,
  onFlush,
  onDeleteTemplate,
  onCreateNoteFromTemplate,
  onResizePointerDown,
  onResizeKeyDown,
  onBackToNotes
}: TemplateManagerProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const editorShellRef = useRef<HTMLDivElement>(null);
  const previousTemplateIdRef = useRef<string | null>(null);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const sortedTemplates = sortNoteTemplatesByName(templates);
  const selectedCompletion = selectedTemplate
    ? getNoteTemplateCompletion(selectedTemplate, templates)
    : null;

  useEffect(() => {
    if (!selectedTemplate) {
      previousTemplateIdRef.current = null;
      return;
    }

    if (previousTemplateIdRef.current !== selectedTemplate.id) {
      editorRef.current?.setMarkdown(selectedTemplate.markdown);
      previousTemplateIdRef.current = selectedTemplate.id;
      window.requestAnimationFrame(focusEditorStart);
    }
  }, [selectedTemplate]);

  return (
    <main
      className={`template-manager${isResizingSidebar ? ' template-manager--resizing' : ''}`}
      aria-label="テンプレート管理"
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <aside className="template-sidebar" aria-label="テンプレート一覧">
        <div className="template-sidebar__header">
          <h1>テンプレート</h1>
          <button
            className="icon-button"
            type="button"
            onClick={onCreateTemplate}
            aria-label="新しいテンプレートを作成"
            data-tooltip="新しいテンプレートを作成"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="template-list" role="listbox" aria-label="テンプレート一覧">
          {sortedTemplates.map((template) => {
            const selected = template.id === selectedTemplateId;
            const completion = getNoteTemplateCompletion(template, templates);
            const visibleStatus = getVisibleTemplateStatus(template, completion.reason);
            const displayName = template.name.trim() || '名称未設定';

            return (
              <button
                key={template.id}
                className="template-card"
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelectTemplate(template.id)}
              >
                <span className="template-card__name">{displayName}</span>
                {visibleStatus ? (
                  <span className="template-card__status">{visibleStatus}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="template-sidebar__footer">
          <button
            className="back-button back-button--visible"
            type="button"
            onClick={onBackToNotes}
            aria-label="Noteへ戻る"
            data-tooltip="Noteへ戻る"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        </div>
      </aside>
      <div
        className="pane-resizer"
        role="separator"
        aria-label="テンプレート一覧の幅を変更"
        aria-orientation="vertical"
        aria-valuemin={260}
        aria-valuemax={520}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        onPointerDown={onResizePointerDown}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            onResizeKeyDown('narrower');
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            onResizeKeyDown('wider');
          }
        }}
      />

      <section className="template-editor" aria-label="選択中のテンプレート">
        {!selectedTemplate ? (
          <div className="template-editor__empty">
            <p>テンプレートを選択するか、新しく作成してください。</p>
          </div>
        ) : (
          <>
            <header className="template-editor__toolbar">
              <label className="template-name-field">
                <span className="visually-hidden">テンプレート名</span>
                <input
                  value={selectedTemplate.name}
                  onChange={(event) => onChangeTemplateName(event.currentTarget.value)}
                  onBlur={onFlush}
                  placeholder="テンプレート名"
                />
              </label>
              <button
                className="icon-button"
                type="button"
                onClick={() => onCreateNoteFromTemplate(selectedTemplate.id)}
                disabled={!selectedCompletion?.complete}
                aria-label="このテンプレートでNoteを作成"
                data-tooltip="このテンプレートでNoteを作成"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M6 3h9l3 3v15H6z" />
                  <path d="M15 3v4h4" />
                  <path d="M12 11v6" />
                  <path d="M9 14h6" />
                </svg>
              </button>
              <button
                className="delete-button"
                type="button"
                onClick={onDeleteTemplate}
                aria-label="テンプレートを削除"
                data-tooltip="テンプレートを削除"
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

            {selectedCompletion &&
            getVisibleTemplateStatus(selectedTemplate, selectedCompletion.reason) ? (
              <div className="template-status" role="status">
                {getVisibleTemplateStatus(selectedTemplate, selectedCompletion.reason)}
              </div>
            ) : null}

            {storageError ? (
              <div className="storage-error" role="alert">
                <strong>保存できません。</strong>
                <span>{storageError}</span>
              </div>
            ) : null}

            <div
              ref={editorShellRef}
              className="editor-shell"
              onBlurCapture={handleEditorBlur}
              onPasteCapture={handleEditorPaste}
            >
              <MDXEditor
                ref={editorRef}
                markdown={selectedTemplate.markdown}
                onChange={(markdown) =>
                  onChangeTemplateMarkdown(normalizeSupportedMarkdown(markdown))
                }
                plugins={editorPlugins}
                contentEditableClassName="jot-editor"
              />
            </div>
          </>
        )}
      </section>
    </main>
  );

  function focusEditorStart() {
    const editor = getEditorRoot();
    if (!editor) {
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

  function handleEditorBlur() {
    syncSelectedTemplateMarkdown();
    onFlush();
  }

  function handleEditorPaste() {
    window.requestAnimationFrame(syncSelectedTemplateMarkdown);
  }

  function syncSelectedTemplateMarkdown() {
    syncNormalizedEditorMarkdown(
      editorRef.current,
      selectedTemplate?.markdown ?? '',
      onChangeTemplateMarkdown,
      getEditorRoot()
    );
  }

  function getEditorRoot(): HTMLElement | null {
    const editor = editorShellRef.current?.querySelector('[contenteditable="true"]');
    return editor instanceof HTMLElement ? editor : null;
  }
}

function getVisibleTemplateStatus(template: NoteTemplate, reason: string | null): string | null {
  if (reason === '名前が未入力です' && !template.markdown.trim()) {
    return null;
  }

  return reason;
}
