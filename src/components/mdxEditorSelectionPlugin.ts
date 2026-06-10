import { createRootEditorSubscription$, realmPlugin } from '@mdxeditor/editor';
import type { LexicalEditor, LexicalNode } from 'lexical';
import {
  $createRangeSelection,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection
} from 'lexical';

export const taskCheckboxHitAreaWidthPx = 24;

const editorsByRoot = new WeakMap<HTMLElement, LexicalEditor>();

type TaskTextMouseDownEvent = Pick<
  MouseEvent,
  'button' | 'detail' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'
>;
type TextSelectionRange = { offset: number; endOffset: number };
type WordSegment = { segment: string; index: number; isWordLike?: boolean };
type WordSegmenter = { segment: (input: string) => Iterable<WordSegment> };
type IntlWithSegmenter = typeof Intl & {
  Segmenter?: new (locale?: string, options?: { granularity: 'word' }) => WordSegmenter;
};

export const mdxEditorSelectionPlugin = realmPlugin({
  init(realm) {
    realm.pub(createRootEditorSubscription$, (editor) => {
      function handleTaskTextMouseDown(event: MouseEvent) {
        if (!shouldHandleTaskTextMouseDown(event)) {
          return;
        }

        const target = event.target instanceof Node ? event.target : null;
        const targetElement =
          target instanceof HTMLElement ? target : (target?.parentElement ?? null);
        const checkbox = targetElement?.closest('[role="checkbox"][aria-checked]');
        if (!(checkbox instanceof HTMLElement) || isTaskCheckboxHit(checkbox, event.clientX)) {
          return;
        }

        const range = createCaretRangeFromPoint(event.clientX, event.clientY);
        if (!range || !checkbox.contains(range.startContainer)) {
          return;
        }

        const clientX = event.clientX;
        const clientY = event.clientY;
        const clickCount = event.detail;
        const initialOffset = getTextOffset(checkbox, range.startContainer, range.startOffset);

        window.requestAnimationFrame(() => {
          const selectionTarget = getTaskTextSelectionTarget(clientX, clientY) ?? {
            checkbox,
            offset: initialOffset
          };
          if (!selectionTarget.checkbox.isConnected) {
            return;
          }

          const selectionRange = getTaskTextClickSelectionRange(
            selectionTarget.checkbox.textContent ?? '',
            selectionTarget.offset,
            clickCount
          );

          if (selectionRange.offset === selectionRange.endOffset) {
            selectTextOffsetInEditor(editor, selectionTarget.checkbox, selectionRange.offset);
            restoreBrowserTextSelection(
              selectionTarget.checkbox,
              selectionRange.offset,
              selectionRange.endOffset
            );
            return;
          }

          selectTextRangeInEditor(
            editor,
            selectionTarget.checkbox,
            selectionRange.offset,
            selectionTarget.checkbox,
            selectionRange.endOffset
          );
          restoreBrowserTextSelection(
            selectionTarget.checkbox,
            selectionRange.offset,
            selectionRange.endOffset
          );
        });
      }

      return editor.registerRootListener((rootElement, previousRootElement) => {
        if (previousRootElement) {
          editorsByRoot.delete(previousRootElement);
          previousRootElement.removeEventListener('mousedown', handleTaskTextMouseDown, true);
        }

        if (rootElement) {
          editorsByRoot.set(rootElement, editor);
          rootElement.addEventListener('mousedown', handleTaskTextMouseDown, true);
        }
      });
    });
  }
});

export function shouldHandleTaskTextMouseDown(event: TaskTextMouseDownEvent): boolean {
  return (
    event.button === 0 &&
    event.detail >= 1 &&
    !event.shiftKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  );
}

export function getTaskTextClickSelectionRange(
  text: string,
  offset: number,
  clickCount: number
): TextSelectionRange {
  const boundedOffset = Math.min(Math.max(offset, 0), text.length);
  if (clickCount <= 1) {
    return { offset: boundedOffset, endOffset: boundedOffset };
  }

  if (clickCount >= 3) {
    return { offset: 0, endOffset: text.length };
  }

  return getWordSelectionRange(text, boundedOffset);
}

export function selectMdxEditorTextOffset(scope: HTMLElement, offset: number): boolean {
  const root = scope.closest('[contenteditable="true"]');
  if (!(root instanceof HTMLElement)) {
    return false;
  }

  const editor = editorsByRoot.get(root);
  if (!editor) {
    return false;
  }

  return selectTextOffsetInEditor(editor, scope, offset);
}

export function selectMdxEditorTextRange(
  startScope: HTMLElement,
  startOffset: number,
  endScope: HTMLElement,
  endOffset: number
): boolean {
  const root = startScope.closest('[contenteditable="true"]');
  if (!(root instanceof HTMLElement) || root !== endScope.closest('[contenteditable="true"]')) {
    return false;
  }

  const editor = editorsByRoot.get(root);
  if (!editor) {
    return false;
  }

  return selectTextRangeInEditor(editor, startScope, startOffset, endScope, endOffset);
}

export function getSelectedMdxEditorElement(
  scope: HTMLElement,
  selector: string
): HTMLElement | null {
  const root = scope.closest('[contenteditable="true"]');
  if (!(root instanceof HTMLElement)) {
    return null;
  }

  const editor = editorsByRoot.get(root);
  if (!editor) {
    return null;
  }

  let selectedElement: HTMLElement | null = null;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }

    let node: LexicalNode | null = selection.anchor.getNode();
    while (node) {
      const element = editor.getElementByKey(node.getKey());
      if (element instanceof HTMLElement && element.matches(selector) && root.contains(element)) {
        selectedElement = element;
        return;
      }

      node = node.getParent();
    }
  });

  return selectedElement;
}

export function getTextOffset(root: Node, target: Node, targetOffset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);

  try {
    range.setEnd(target, targetOffset);
    return range.toString().length;
  } catch {
    return root.textContent?.length ?? 0;
  }
}

export function findTextPosition(root: Node, targetOffset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remainingOffset = targetOffset;
  let lastTextNode: Node | null = null;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const textLength = node.textContent?.length ?? 0;
    lastTextNode = node;

    if (remainingOffset <= textLength) {
      return { node, offset: remainingOffset };
    }

    remainingOffset -= textLength;
  }

  if (lastTextNode) {
    return { node: lastTextNode, offset: lastTextNode.textContent?.length ?? 0 };
  }

  return { node: root, offset: 0 };
}

export function isTaskCheckboxHit(checkbox: HTMLElement, clientX: number): boolean {
  const checkboxRect = checkbox.getBoundingClientRect();
  const clickX = clientX - checkboxRect.left;
  return clickX >= 0 && clickX <= taskCheckboxHitAreaWidthPx;
}

function getWordSelectionRange(text: string, offset: number): TextSelectionRange {
  if (text.length === 0) {
    return { offset: 0, endOffset: 0 };
  }

  const segmentedRange = getSegmentedWordSelectionRange(text, offset);
  if (segmentedRange) {
    return segmentedRange;
  }

  return getFallbackWordSelectionRange(text, offset);
}

function getTaskTextSelectionTarget(
  clientX: number,
  clientY: number
): { checkbox: HTMLElement; offset: number } | null {
  const range = createCaretRangeFromPoint(clientX, clientY);
  if (!range) {
    return null;
  }

  const targetElement =
    range.startContainer instanceof HTMLElement
      ? range.startContainer
      : range.startContainer.parentElement;
  const checkbox = targetElement?.closest('[role="checkbox"][aria-checked]');
  if (!(checkbox instanceof HTMLElement) || isTaskCheckboxHit(checkbox, clientX)) {
    return null;
  }

  if (!checkbox.contains(range.startContainer)) {
    return null;
  }

  return {
    checkbox,
    offset: getTextOffset(checkbox, range.startContainer, range.startOffset)
  };
}

function getSegmentedWordSelectionRange(text: string, offset: number): TextSelectionRange | null {
  const Segmenter = (Intl as IntlWithSegmenter).Segmenter;
  if (!Segmenter) {
    return null;
  }

  const targetOffset = getTargetCharacterOffset(text, offset);
  for (const segment of new Segmenter(undefined, { granularity: 'word' }).segment(text)) {
    const endOffset = segment.index + segment.segment.length;
    if (targetOffset < segment.index || targetOffset >= endOffset) {
      continue;
    }

    if (segment.isWordLike || segment.segment.trim() !== '') {
      return { offset: segment.index, endOffset };
    }

    return { offset, endOffset: offset };
  }

  return null;
}

function getFallbackWordSelectionRange(text: string, offset: number): TextSelectionRange {
  const targetOffset = getTargetCharacterOffset(text, offset);
  if (isSelectionBoundary(text[targetOffset])) {
    return { offset, endOffset: offset };
  }

  let startOffset = targetOffset;
  while (startOffset > 0 && !isSelectionBoundary(text[startOffset - 1])) {
    startOffset -= 1;
  }

  let endOffset = targetOffset + 1;
  while (endOffset < text.length && !isSelectionBoundary(text[endOffset])) {
    endOffset += 1;
  }

  return { offset: startOffset, endOffset };
}

function getTargetCharacterOffset(text: string, offset: number): number {
  return Math.min(offset, text.length - 1);
}

function isSelectionBoundary(character: string): boolean {
  return /[\s.,;:!?()[\]{}"'`。、！？（）「」『』【】]/.test(character);
}

function restoreBrowserTextSelection(scope: HTMLElement, offset: number, endOffset: number) {
  const editorRoot = scope.closest('[contenteditable="true"]');
  if (editorRoot instanceof HTMLElement) {
    focusEditorRootElementWithoutScrolling(editorRoot);
  }

  const startPosition = findTextPosition(scope, offset);
  const endPosition = findTextPosition(scope, endOffset);
  const range = document.createRange();
  range.setStart(startPosition.node, startPosition.offset);
  range.setEnd(endPosition.node, endPosition.offset);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function selectTextOffsetInEditor(
  editor: LexicalEditor,
  scope: HTMLElement,
  offset: number
): boolean {
  const position = findTextPosition(scope, offset);
  let selected = false;
  focusEditorRootWithoutScrolling(editor);
  editor.update(
    () => {
      const lexicalNode =
        $getNearestNodeFromDOMNode(position.node) ??
        (position.node.parentElement
          ? $getNearestNodeFromDOMNode(position.node.parentElement)
          : null);

      if ($isTextNode(lexicalNode)) {
        const boundedOffset = Math.min(position.offset, lexicalNode.getTextContentSize());
        lexicalNode.select(boundedOffset, boundedOffset);
        selected = true;
      } else if ($isElementNode(lexicalNode)) {
        lexicalNode.selectStart();
        selected = true;
      }
    },
    { discrete: true }
  );
  return selected;
}

function selectTextRangeInEditor(
  editor: LexicalEditor,
  startScope: HTMLElement,
  startOffset: number,
  endScope: HTMLElement,
  endOffset: number
): boolean {
  const startPosition = findTextPosition(startScope, startOffset);
  const endPosition = findTextPosition(endScope, endOffset);
  let selected = false;
  focusEditorRootWithoutScrolling(editor);

  editor.update(
    () => {
      const startPoint = getLexicalSelectionPoint(startPosition.node, startPosition.offset);
      const endPoint = getLexicalSelectionPoint(endPosition.node, endPosition.offset);
      if (!startPoint || !endPoint) {
        return;
      }

      const selection = $createRangeSelection();
      selection.anchor.set(startPoint.key, startPoint.offset, startPoint.type);
      selection.focus.set(endPoint.key, endPoint.offset, endPoint.type);
      $setSelection(selection);
      selected = true;
    },
    { discrete: true }
  );
  return selected;
}

function focusEditorRootWithoutScrolling(editor: LexicalEditor) {
  const root = editor.getRootElement();
  if (root) {
    focusEditorRootElementWithoutScrolling(root);
  }
}

function focusEditorRootElementWithoutScrolling(root: HTMLElement) {
  try {
    root.focus({ preventScroll: true });
  } catch {
    root.focus();
  }
}

function getLexicalSelectionPoint(
  node: Node,
  offset: number
): { key: string; offset: number; type: 'text' | 'element' } | null {
  const lexicalNode =
    $getNearestNodeFromDOMNode(node) ??
    (node.parentElement ? $getNearestNodeFromDOMNode(node.parentElement) : null);

  if ($isTextNode(lexicalNode)) {
    return {
      key: lexicalNode.getKey(),
      offset: Math.min(offset, lexicalNode.getTextContentSize()),
      type: 'text'
    };
  }

  if ($isElementNode(lexicalNode)) {
    return {
      key: lexicalNode.getKey(),
      offset: Math.min(offset, lexicalNode.getChildrenSize()),
      type: 'element'
    };
  }

  return null;
}

function createCaretRangeFromPoint(clientX: number, clientY: number): Range | null {
  if ('caretPositionFromPoint' in document) {
    const position = document.caretPositionFromPoint(clientX, clientY);
    if (position) {
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      return range;
    }
  }

  const legacyDocument = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  return legacyDocument.caretRangeFromPoint?.(clientX, clientY) ?? null;
}
