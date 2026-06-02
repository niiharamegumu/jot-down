import {
  findTextPosition,
  getSelectedMdxEditorElement,
  getTextOffset,
  selectMdxEditorTextOffset
} from './mdxEditorSelectionPlugin';

export type NoteLineSelectionSnapshot = {
  noteId: string;
  lineIndex: number;
  markdown: string;
  offset: number;
  scrollPositions: ScrollPositionSnapshot[];
};

type ScrollPositionSnapshot = {
  target: Element;
  top: number;
  left: number;
};

const editorLineSelector = 'h1,h2,h3,h4,h5,h6,p,li';
const markdownListItemPattern = /^(\s*)([-*])\s+(?:\[(?: |x|X)\]\s+)?/;

export function getSelectedNoteLineIndex(root: HTMLElement, markdown: string): number {
  const selectedLine = getSelectedNoteLineElement(root);
  if (!selectedLine) {
    return -1;
  }

  return getMarkdownLineIndexForEditorLine(markdown, root, selectedLine);
}

export function captureNoteLineSelectionSnapshot(
  noteId: string,
  nextLineIndex: number,
  root: HTMLElement,
  nextMarkdown: string
): NoteLineSelectionSnapshot | null {
  const selectedLine = getSelectedNoteLineElement(root);
  if (!selectedLine) {
    return null;
  }

  const selection = window.getSelection();
  const selectedNode = selection?.anchorNode;
  const offset =
    selectedNode && selectedLine.contains(selectedNode)
      ? getTextOffset(selectedLine, selectedNode, selection.anchorOffset)
      : 0;

  return {
    noteId,
    lineIndex: nextLineIndex,
    markdown: nextMarkdown,
    offset,
    scrollPositions: captureScrollPositions(selectedLine)
  };
}

export function restoreNoteLineSelectionSnapshot(
  snapshot: NoteLineSelectionSnapshot,
  getCurrentNoteId: () => string | null,
  root: HTMLElement | null,
  scheduleAnimationFrame: typeof window.requestAnimationFrame = window.requestAnimationFrame
) {
  if (snapshot.noteId !== getCurrentNoteId() || !root) {
    return;
  }

  const line = getEditorLineElementAtMarkdownLine(root, snapshot.markdown, snapshot.lineIndex);
  if (!line) {
    return;
  }

  restoreScrollPositions(snapshot.scrollPositions);

  if (!selectMdxEditorTextOffset(line, snapshot.offset)) {
    focusWithoutScrolling(line);

    const position = findTextPosition(line, snapshot.offset);
    const range = document.createRange();
    range.setStart(position.node, position.offset);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  restoreScrollPositions(snapshot.scrollPositions);
  scheduleAnimationFrame(() => {
    if (snapshot.noteId === getCurrentNoteId()) {
      restoreScrollPositions(snapshot.scrollPositions);
    }
  });
}

function getSelectedNoteLineElement(root: HTMLElement): HTMLElement | null {
  const lexicalLine = getSelectedMdxEditorElement(root, editorLineSelector);
  if (lexicalLine) {
    return lexicalLine;
  }

  const selection = window.getSelection();
  const selectedNode = selection?.anchorNode;
  if (!selectedNode || !root.contains(selectedNode)) {
    return null;
  }

  if (selectedNode === root) {
    return getLineFromRootOffset(root, selection.anchorOffset);
  }

  const selectedElement =
    selectedNode instanceof HTMLElement ? selectedNode : selectedNode.parentElement;
  const line = selectedElement?.closest(editorLineSelector);
  return line instanceof HTMLElement && root.contains(line) ? line : null;
}

function getLineFromRootOffset(root: HTMLElement, offset: number): HTMLElement | null {
  const child = root.childNodes[Math.min(offset, Math.max(root.childNodes.length - 1, 0))];
  const childElement = child instanceof HTMLElement ? child : child?.parentElement;
  const line =
    childElement?.closest(editorLineSelector) ?? childElement?.querySelector(editorLineSelector);
  return line instanceof HTMLElement && root.contains(line) ? line : null;
}

function getNoteLineElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll(editorLineSelector)).filter(
    (line): line is HTMLElement =>
      line instanceof HTMLElement && !isNestedListWrapperWithoutOwnLineText(line)
  );
}

function isNestedListWrapperWithoutOwnLineText(line: HTMLElement): boolean {
  if (line.tagName !== 'LI') {
    return false;
  }

  const hasNestedList = Boolean(line.querySelector(':scope > ul, :scope > ol'));
  if (!hasNestedList) {
    return false;
  }

  return !Array.from(line.childNodes).some((child) =>
    child.nodeType === Node.TEXT_NODE
      ? Boolean(child.textContent?.trim())
      : child instanceof HTMLElement &&
        child.matches('span[data-lexical-text="true"],br,input[type="checkbox"]')
  );
}

function getMarkdownLineIndexForEditorLine(
  markdown: string,
  root: HTMLElement,
  targetLine: HTMLElement
): number {
  const editorLineIndex = getNoteLineElements(root).indexOf(targetLine);
  if (editorLineIndex < 0) {
    return -1;
  }

  return getEditorRepresentedMarkdownLineIndices(markdown)[editorLineIndex] ?? -1;
}

function getEditorLineElementAtMarkdownLine(
  root: HTMLElement,
  markdown: string,
  targetLineIndex: number
): HTMLElement | null {
  const editorLineIndex = getEditorRepresentedMarkdownLineIndex(markdown, targetLineIndex);
  if (editorLineIndex < 0) {
    return null;
  }

  return getNoteLineElements(root)[editorLineIndex] ?? null;
}

function getEditorRepresentedMarkdownLineIndex(markdown: string, targetLineIndex: number): number {
  const lineIndices = getEditorRepresentedMarkdownLineIndices(markdown);
  const exactIndex = lineIndices.indexOf(targetLineIndex);
  if (exactIndex >= 0) {
    return exactIndex;
  }

  for (let index = lineIndices.length - 1; index >= 0; index -= 1) {
    if (lineIndices[index] < targetLineIndex) {
      return index;
    }
  }

  return -1;
}

function getEditorRepresentedMarkdownLineIndices(markdown: string): number[] {
  const lines = markdown.split(/\r?\n/);
  const lineIndices: number[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    if (isBlankMarkdownLine(lines[lineIndex])) {
      lineIndex += 1;
      continue;
    }

    const listItem = lines[lineIndex].match(markdownListItemPattern);
    lineIndices.push(lineIndex);
    lineIndex += 1;

    if (listItem) {
      const listItemIndent = listItem[1].length;
      while (
        lineIndex < lines.length &&
        isMarkdownListItemContinuationLine(lines[lineIndex], listItemIndent)
      ) {
        lineIndex += 1;
      }
    }
  }

  return lineIndices;
}

function isMarkdownListItemContinuationLine(line: string, listItemIndent: number): boolean {
  if (isBlankMarkdownLine(line) || markdownListItemPattern.test(line)) {
    return false;
  }

  return getMarkdownLineIndentLength(line) > listItemIndent;
}

function getMarkdownLineIndentLength(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function isBlankMarkdownLine(line: string): boolean {
  return line.trim() === '';
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
