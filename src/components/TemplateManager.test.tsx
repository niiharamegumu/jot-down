import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TemplateManager } from './TemplateManager';

const mockSetMarkdown = vi.fn();
const mockGetMarkdown = vi.fn();

vi.mock('@mdxeditor/editor', async () => {
  const React = await import('react');

  return {
    createRootEditorSubscription$: Symbol('createRootEditorSubscription$'),
    headingsPlugin: vi.fn(),
    linkDialogPlugin: vi.fn(),
    linkPlugin: vi.fn(),
    listsPlugin: vi.fn(),
    markdownShortcutPlugin: vi.fn(),
    realmPlugin: vi.fn((plugin) => () => plugin),
    MDXEditor: React.forwardRef(function MockMDXEditor({ markdown }: { markdown: string }, ref) {
      React.useImperativeHandle(ref, () => ({
        getMarkdown: mockGetMarkdown,
        setMarkdown: mockSetMarkdown,
        focus: (callback?: () => void) => callback?.()
      }));

      const link = markdown.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        return (
          <div aria-label="Markdown editor" contentEditable suppressContentEditableWarning>
            <a href={link[2]} onClick={(event) => event.preventDefault()}>
              {link[1]}
            </a>
          </div>
        );
      }

      return <textarea aria-label="Markdown editor" value={markdown} readOnly />;
    })
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TemplateManager', () => {
  it('does not show a missing-name warning before template Markdown exists', () => {
    renderManager({
      templates: [
        {
          id: 'template-1',
          name: '',
          markdown: '',
          updatedAt: '2026-05-28T00:00:00.000Z'
        }
      ],
      selectedTemplateId: 'template-1'
    });

    expect(screen.queryByText('名前が未入力です')).not.toBeInTheDocument();
  });

  it('shows a missing-name warning after template Markdown exists', () => {
    renderManager({
      templates: [
        {
          id: 'template-1',
          name: '',
          markdown: '# 会議',
          updatedAt: '2026-05-28T00:00:00.000Z'
        }
      ],
      selectedTemplateId: 'template-1'
    });

    expect(screen.getAllByText('名前が未入力です')).toHaveLength(2);
  });

  it('reimports pasted plain URLs as Markdown links in template Markdown', () => {
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return 1;
    });
    const onChangeTemplateMarkdown = vi.fn();
    mockGetMarkdown.mockReturnValue('参考https://example.com/templateを見る');

    renderManager({
      templates: [
        {
          id: 'template-1',
          name: '会議',
          markdown: '参考',
          updatedAt: '2026-05-28T00:00:00.000Z'
        }
      ],
      selectedTemplateId: 'template-1',
      onChangeTemplateMarkdown
    });
    animationFrameCallbacks.at(-1)?.(0);
    animationFrameCallbacks.length = 0;
    mockSetMarkdown.mockClear();

    fireEvent.paste(screen.getByLabelText('Markdown editor'));
    animationFrameCallbacks.at(-1)?.(0);

    const normalizedMarkdown =
      '参考[https://example.com/template](https://example.com/template)を見る';
    expect(mockSetMarkdown).toHaveBeenCalledWith(normalizedMarkdown);
    expect(onChangeTemplateMarkdown).toHaveBeenCalledWith(normalizedMarkdown);
  });

  it('opens a template Markdown link with command click', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    renderManager({
      templates: [
        {
          id: 'template-1',
          name: '会議',
          markdown: '[MDXEditor](https://mdxeditor.dev/)',
          updatedAt: '2026-05-28T00:00:00.000Z'
        }
      ],
      selectedTemplateId: 'template-1'
    });

    fireEvent.click(screen.getByRole('link', { name: 'MDXEditor' }), { metaKey: true });

    expect(open).toHaveBeenCalledWith('https://mdxeditor.dev/', '_blank', 'noopener,noreferrer');
  });

  it('collapses to a template list navigation toggle', () => {
    const onToggleListNav = vi.fn();

    renderManager({
      isListNavCollapsed: true,
      templates: [
        {
          id: 'template-1',
          name: '会議',
          markdown: '# 会議',
          updatedAt: '2026-05-28T00:00:00.000Z'
        }
      ],
      selectedTemplateId: 'template-1',
      onToggleListNav
    });

    fireEvent.click(screen.getByRole('button', { name: 'テンプレート一覧を開く' }));

    expect(screen.getByRole('complementary', { name: 'テンプレート一覧' })).toHaveClass(
      'template-sidebar--collapsed'
    );
    expect(screen.getByRole('option', { name: /会議/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Noteへ戻る' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Note一覧へ移動' })).toBeInTheDocument();
    expect(onToggleListNav).toHaveBeenCalledTimes(1);
  });
});

function renderManager(props: Partial<React.ComponentProps<typeof TemplateManager>> = {}) {
  return render(
    <TemplateManager
      templates={[]}
      selectedTemplateId={null}
      mobileView="list"
      sidebarWidth={360}
      isSmallScreen={false}
      canToggleListNav={true}
      isListNavCollapsed={false}
      isListNavPeeking={false}
      isResizingSidebar={false}
      storageError={null}
      onCreateTemplate={vi.fn()}
      onSelectTemplate={vi.fn()}
      onChangeTemplateName={vi.fn()}
      onChangeTemplateMarkdown={vi.fn()}
      onFlush={vi.fn()}
      onDeleteTemplate={vi.fn()}
      onCreateNoteFromTemplate={vi.fn()}
      onResizePointerDown={vi.fn()}
      onResizeKeyDown={vi.fn()}
      onBackToNotes={vi.fn()}
      onBackToTemplateList={vi.fn()}
      onToggleListNav={vi.fn()}
      onPeekListNav={vi.fn()}
      onHideListNavPeek={vi.fn()}
      {...props}
    />
  );
}
