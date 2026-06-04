import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMdxEditorFloatingUiFixes } from './editorFloatingUi';

vi.mock('./mdxEditorSelectionPlugin', () => ({
  selectMdxEditorTextOffset: vi.fn()
}));

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('editorFloatingUi', () => {
  it('hides the link preview dialog while no editor link is hovered', async () => {
    const uninstall = installMdxEditorFloatingUiFixes();
    const dialog = createLinkPreviewDialog();

    document.body.append(dialog);
    await waitForMutationObserver();

    expect(dialog).toHaveAttribute('data-editor-link-dialog-hidden');
    expect(dialog.getAttribute('data-editor-link-dialog-hidden')).toBe('');

    uninstall();
  });

  it('shows the MDX link preview dialog while an editor link is hovered', async () => {
    vi.useFakeTimers();
    const uninstall = installMdxEditorFloatingUiFixes();
    const editor = document.createElement('div');
    editor.className = 'jot-editor';
    const link = document.createElement('a');
    link.href = 'https://example.com/';
    link.textContent = 'Example';
    editor.append(link);
    const dialog = createLinkPreviewDialog();
    document.body.append(editor, dialog);
    await waitForMutationObserver();

    link.dispatchEvent(new Event('pointerover', { bubbles: true }));

    expect(dialog).not.toHaveAttribute('data-editor-link-dialog-hidden');

    link.dispatchEvent(new Event('pointerout', { bubbles: true }));
    vi.runAllTimers();

    expect(dialog).toHaveAttribute('data-editor-link-dialog-hidden');

    uninstall();
  });

  it('hides the MDX link preview dialog when a child element leaves the editor link', async () => {
    vi.useFakeTimers();
    const uninstall = installMdxEditorFloatingUiFixes();
    const editor = document.createElement('div');
    editor.className = 'jot-editor';
    const link = document.createElement('a');
    link.href = 'https://example.com/';
    const text = document.createElement('span');
    text.textContent = 'Example';
    link.append(text);
    editor.append(link);
    const dialog = createLinkPreviewDialog();
    document.body.append(editor, dialog);
    await waitForMutationObserver();

    link.dispatchEvent(new Event('pointerover', { bubbles: true }));
    text.dispatchEvent(new Event('pointerout', { bubbles: true }));
    vi.runAllTimers();

    expect(dialog).toHaveAttribute('data-editor-link-dialog-hidden');

    uninstall();
  });

  it('keeps the MDX link preview dialog visible while the dialog itself is hovered', async () => {
    vi.useFakeTimers();
    const uninstall = installMdxEditorFloatingUiFixes();
    const editor = document.createElement('div');
    editor.className = 'jot-editor';
    const link = document.createElement('a');
    link.href = 'https://example.com/';
    link.textContent = 'Example';
    editor.append(link);
    const dialog = createLinkPreviewDialog();
    document.body.append(editor, dialog);
    await waitForMutationObserver();

    link.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: dialog }));
    dialog.dispatchEvent(new Event('pointerover', { bubbles: true }));
    vi.runAllTimers();

    expect(dialog).not.toHaveAttribute('data-editor-link-dialog-hidden');

    uninstall();
  });

  it('hides the MDX link preview dialog when the pointer moves outside the link and dialog', async () => {
    vi.useFakeTimers();
    const uninstall = installMdxEditorFloatingUiFixes();
    const editor = document.createElement('div');
    editor.className = 'jot-editor';
    const link = document.createElement('a');
    link.href = 'https://example.com/';
    link.textContent = 'Example';
    editor.append(link);
    const dialog = createLinkPreviewDialog();
    document.body.append(editor, dialog);
    await waitForMutationObserver();

    link.dispatchEvent(new Event('pointerover', { bubbles: true }));
    document.body.dispatchEvent(new Event('pointermove', { bubbles: true }));
    vi.runAllTimers();

    expect(dialog).toHaveAttribute('data-editor-link-dialog-hidden');

    uninstall();
  });
});

function createLinkPreviewDialog(): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.className = '_linkDialogPopoverContent_test';
  const link = document.createElement('a');
  link.href = 'https://example.com/';
  link.target = '_blank';
  link.rel = 'noreferrer';
  dialog.append(link);
  return dialog;
}

function waitForMutationObserver(): Promise<void> {
  return Promise.resolve();
}
