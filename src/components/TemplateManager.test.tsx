import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TemplateManager } from './TemplateManager';

const mockSetMarkdown = vi.fn();
const mockGetMarkdown = vi.fn();

vi.mock('@mdxeditor/editor', async () => {
  const React = await import('react');

  return {
    headingsPlugin: vi.fn(),
    linkDialogPlugin: vi.fn(),
    linkPlugin: vi.fn(),
    listsPlugin: vi.fn(),
    markdownShortcutPlugin: vi.fn(),
    MDXEditor: React.forwardRef(function MockMDXEditor({ markdown }: { markdown: string }, ref) {
      React.useImperativeHandle(ref, () => ({
        getMarkdown: mockGetMarkdown,
        setMarkdown: mockSetMarkdown
      }));

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
});

function renderManager(props: Partial<React.ComponentProps<typeof TemplateManager>> = {}) {
  return render(
    <TemplateManager
      templates={[]}
      selectedTemplateId={null}
      sidebarWidth={360}
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
      {...props}
    />
  );
}
