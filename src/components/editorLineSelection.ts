import {
  findTextPosition,
  getSelectedMdxEditorElement,
  getTextOffset,
  selectMdxEditorTextOffset,
  selectMdxEditorTextRange
} from './mdxEditorSelectionPlugin';
import type { NoteLineRange } from '../domain/note';

export type NoteLineSelectionSnapshot = {
  noteId: string;
  lineIndex: number;
  endLineIndex: number;
  markdown: string;
  offset: number;
  endOffset: number;
  revealSelection?: boolean;
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
  return getSelectedNoteLineRange(root, markdown)?.startLineIndex ?? -1;
}

export function getSelectedNoteLineRange(
  root: HTMLElement,
  markdown: string
): NoteLineRange | null {
  const selectedLines = getSelectedNoteLineElements(root);
  if (selectedLines.length === 0) {
    const selectedLine = getSelectedNoteLineElement(root);
    if (!selectedLine) {
      return null;
    }

    const lineIndex = getMarkdownLineIndexForEditorLine(markdown, root, selectedLine);
    return lineIndex < 0 ? null : { startLineIndex: lineIndex, endLineIndex: lineIndex };
  }

  const lineIndexes = selectedLines
    .map((line) => getMarkdownLineIndexForEditorLine(markdown, root, line))
    .filter((lineIndex) => lineIndex >= 0);

  if (lineIndexes.length === 0) {
    return null;
  }

  return {
    startLineIndex: Math.min(...lineIndexes),
    endLineIndex: Math.max(...lineIndexes)
  };
}

export function captureNoteLineSelectionSnapshot(
  noteId: string,
  nextLineIndex: number,
  root: HTMLElement,
  nextMarkdown: string
): NoteLineSelectionSnapshot | null {
  return captureNoteLineRangeSelectionSnapshot(
    noteId,
    { startLineIndex: nextLineIndex, endLineIndex: nextLineIndex },
    root,
    nextMarkdown
  );
}

export function captureNoteLineRangeSelectionSnapshot(
  noteId: string,
  nextLineRange: NoteLineRange,
  root: HTMLElement,
  nextMarkdown: string
): NoteLineSelectionSnapshot | null {
  const selectedLines = getSelectedNoteLineElements(root);
  const selectedLine = selectedLines[0] ?? getSelectedNoteLineElement(root);
  if (!selectedLine) {
    return null;
  }

  const selectionOffsets = getSelectedNoteLineOffsets(root, selectedLines);
  if (!selectionOffsets) {
    return null;
  }

  return {
    noteId,
    lineIndex: nextLineRange.startLineIndex,
    endLineIndex: nextLineRange.endLineIndex,
    markdown: nextMarkdown,
    offset: selectionOffsets.offset,
    endOffset: selectionOffsets.endOffset,
    scrollPositions: captureScrollPositions(selectedLine)
  };
}

export function restoreNoteLineSelectionSnapshot(
  snapshot: NoteLineSelectionSnapshot,
  getCurrentNoteId: () => string | null,
  root: HTMLElement | null,
  scheduleAnimationFrame: typeof window.requestAnimationFrame = window.requestAnimationFrame
): boolean {
  if (snapshot.noteId !== getCurrentNoteId() || !root) {
    return false;
  }

  const line = getEditorLineElementAtMarkdownLine(root, snapshot.markdown, snapshot.lineIndex);
  const endLine = getEditorLineElementAtMarkdownLine(
    root,
    snapshot.markdown,
    snapshot.endLineIndex
  );
  if (!line || !endLine) {
    return false;
  }

  if (!snapshot.revealSelection) {
    restoreScrollPositions(snapshot.scrollPositions);
  }

  if (snapshot.lineIndex !== snapshot.endLineIndex || snapshot.offset !== snapshot.endOffset) {
    selectMdxEditorTextRange(line, snapshot.offset, endLine, snapshot.endOffset);
  } else {
    selectMdxEditorTextOffset(line, snapshot.offset);
  }
  restoreBrowserSelection(line, snapshot.offset, endLine, snapshot.endOffset);

  if (snapshot.revealSelection) {
    scrollLineIntoView(line);
  } else {
    restoreScrollPositions(snapshot.scrollPositions);
  }
  scheduleAnimationFrame(() => {
    if (snapshot.noteId === getCurrentNoteId()) {
      if (snapshot.revealSelection) {
        scrollLineIntoView(line);
      } else {
        restoreScrollPositions(snapshot.scrollPositions);
      }
    }
  });
  return true;
}

function scrollLineIntoView(line: HTMLElement) {
  line.scrollIntoView?.({ block: 'nearest' });
}

function restoreBrowserSelection(
  line: HTMLElement,
  offset: number,
  endLine: HTMLElement,
  endOffset: number
) {
  focusWithoutScrolling(line.closest('[contenteditable="true"]') ?? line);

  const startPosition = findTextPosition(line, offset);
  const endPosition = findTextPosition(endLine, endOffset);
  const range = document.createRange();
  range.setStart(startPosition.node, startPosition.offset);
  range.setEnd(endPosition.node, endPosition.offset);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
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

function getSelectedNoteLineElements(root: HTMLElement): HTMLElement[] {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return [];
  }

  const selectionRange = selection.getRangeAt(0);
  if (!root.contains(selectionRange.commonAncestorContainer)) {
    return [];
  }

  return getNoteLineElements(root).filter((line) =>
    getSelectedTextLengthInLine(selectionRange, line)
  );
}

function getSelectedNoteLineOffsets(
  root: HTMLElement,
  selectedLines: HTMLElement[]
): { offset: number; endOffset: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  if (selectedLines.length === 0 || selection.isCollapsed) {
    const selectedLine = getSelectedNoteLineElement(root);
    const selectedNode = selection.anchorNode;
    const offset =
      selectedLine && selectedNode && selectedLine.contains(selectedNode)
        ? getTextOffset(selectedLine, selectedNode, selection.anchorOffset)
        : 0;
    return { offset, endOffset: offset };
  }

  const selectionRange = selection.getRangeAt(0);
  const firstLine = selectedLines[0];
  const lastLine = selectedLines[selectedLines.length - 1];
  const firstLineRange = document.createRange();
  firstLineRange.selectNodeContents(firstLine);
  const lastLineRange = document.createRange();
  lastLineRange.selectNodeContents(lastLine);

  const startsInsideFirstLine = firstLine.contains(selectionRange.startContainer);
  const endsInsideLastLine = lastLine.contains(selectionRange.endContainer);

  return {
    offset: startsInsideFirstLine
      ? getTextOffset(firstLine, selectionRange.startContainer, selectionRange.startOffset)
      : 0,
    endOffset: endsInsideLastLine
      ? getTextOffset(lastLine, selectionRange.endContainer, selectionRange.endOffset)
      : (lastLine.textContent?.length ?? 0)
  };
}

function getSelectedTextLengthInLine(selectionRange: Range, line: HTMLElement): boolean {
  if (!selectionRange.intersectsNode(line)) {
    return false;
  }

  const selectedLineRange = selectionRange.cloneRange();
  const lineRange = document.createRange();
  lineRange.selectNodeContents(line);

  if (selectedLineRange.compareBoundaryPoints(Range.START_TO_START, lineRange) < 0) {
    selectedLineRange.setStart(lineRange.startContainer, lineRange.startOffset);
  }

  if (selectedLineRange.compareBoundaryPoints(Range.END_TO_END, lineRange) > 0) {
    selectedLineRange.setEnd(lineRange.endContainer, lineRange.endOffset);
  }

  return selectedLineRange.toString().length > 0;
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
      line instanceof HTMLElement &&
      !isEmptyEditorLine(line) &&
      !isNestedListWrapperWithoutOwnLineText(line)
  );
}

function isEmptyEditorLine(line: HTMLElement): boolean {
  return line.textContent?.trim() === '' && !line.querySelector('input[type="checkbox"]');
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
