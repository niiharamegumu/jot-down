import type { MDXEditorMethods } from '@mdxeditor/editor';
import { normalizeSupportedMarkdown } from '../domain/note';
import {
  findTextPosition,
  getTextOffset,
  selectMdxEditorTextOffset
} from './mdxEditorSelectionPlugin';

type TextSelectionSnapshot = {
  offset: number;
  scrollPositions: ScrollPositionSnapshot[];
};

type ScrollPositionSnapshot = {
  target: Element;
  top: number;
  left: number;
};

export function syncNormalizedEditorMarkdown(
  editor: MDXEditorMethods | null,
  fallbackMarkdown: string,
  onMarkdownChange: (markdown: string) => void,
  editorRoot: HTMLElement | null = null,
  scheduleAnimationFrame: typeof window.requestAnimationFrame = window.requestAnimationFrame
): boolean {
  const currentMarkdown = editor?.getMarkdown() ?? fallbackMarkdown;
  const normalizedMarkdown = normalizeSupportedMarkdown(currentMarkdown);
  if (normalizedMarkdown === currentMarkdown) {
    return false;
  }

  const selectionSnapshot = editorRoot ? captureTextSelectionSnapshot(editorRoot) : null;
  editor?.setMarkdown(normalizedMarkdown);
  onMarkdownChange(normalizedMarkdown);

  if (selectionSnapshot && editorRoot) {
    restoreTextSelectionSnapshot(editorRoot, selectionSnapshot);
    scheduleAnimationFrame(() => {
      if (editorRoot.isConnected) {
        restoreTextSelectionSnapshot(editorRoot, selectionSnapshot);
      }
    });
  }

  return true;
}

function captureTextSelectionSnapshot(root: HTMLElement): TextSelectionSnapshot | null {
  const selection = window.getSelection();
  if (!selection?.focusNode || !root.contains(selection.focusNode)) {
    return null;
  }

  return {
    offset: getTextOffset(root, selection.focusNode, selection.focusOffset),
    scrollPositions: captureScrollPositions(root)
  };
}

function restoreTextSelectionSnapshot(root: HTMLElement, snapshot: TextSelectionSnapshot) {
  restoreScrollPositions(snapshot.scrollPositions);

  if (!selectMdxEditorTextOffset(root, snapshot.offset)) {
    focusWithoutScrolling(root);

    const position = findTextPosition(root, snapshot.offset);
    const range = document.createRange();
    range.setStart(position.node, position.offset);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  restoreScrollPositions(snapshot.scrollPositions);
}

function focusWithoutScrolling(element: HTMLElement) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function captureScrollPositions(origin: HTMLElement): ScrollPositionSnapshot[] {
  const targets = new Set<Element>();
  const scrollingElement = document.scrollingElement;
  if (scrollingElement) {
    targets.add(scrollingElement);
  }

  let current: HTMLElement | null = origin;
  while (current) {
    if (current.scrollHeight > current.clientHeight || current.scrollWidth > current.clientWidth) {
      targets.add(current);
    }

    current = current.parentElement;
  }

  return Array.from(targets).map((target) => ({
    target,
    top: target.scrollTop,
    left: target.scrollLeft
  }));
}

function restoreScrollPositions(scrollPositions: ScrollPositionSnapshot[]) {
  for (const { target, top, left } of scrollPositions) {
    target.scrollTop = top;
    target.scrollLeft = left;
  }
}
