import { createRootEditorSubscription$, realmPlugin } from '@mdxeditor/editor';
import type { LexicalEditor, LexicalNode } from 'lexical';
import {
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode
} from 'lexical';

export const taskCheckboxHitAreaWidthPx = 24;

const editorsByRoot = new WeakMap<HTMLElement, LexicalEditor>();

export const mdxEditorSelectionPlugin = realmPlugin({
  init(realm) {
    realm.pub(createRootEditorSubscription$, (editor) => {
      function handleTaskTextPointerDown(event: PointerEvent) {
        if (
          event.button !== 0 ||
          event.shiftKey ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey
        ) {
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

        event.preventDefault();
        selectTextOffsetInEditor(
          editor,
          checkbox,
          getTextOffset(checkbox, range.startContainer, range.startOffset)
        );
      }

      return editor.registerRootListener((rootElement, previousRootElement) => {
        if (previousRootElement) {
          editorsByRoot.delete(previousRootElement);
          previousRootElement.removeEventListener('pointerdown', handleTaskTextPointerDown, true);
        }

        if (rootElement) {
          editorsByRoot.set(rootElement, editor);
          rootElement.addEventListener('pointerdown', handleTaskTextPointerDown, true);
        }
      });
    });
  }
});

export function selectMdxEditorTextOffset(scope: HTMLElement, offset: number): boolean {
  const root = scope.closest('[contenteditable="true"]');
  if (!(root instanceof HTMLElement)) {
    return false;
  }

  const editor = editorsByRoot.get(root);
  if (!editor) {
    return false;
  }

  selectTextOffsetInEditor(editor, scope, offset);
  return true;
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

function selectTextOffsetInEditor(editor: LexicalEditor, scope: HTMLElement, offset: number) {
  const position = findTextPosition(scope, offset);
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
      } else if ($isElementNode(lexicalNode)) {
        lexicalNode.selectStart();
      }
    },
    { discrete: true }
  );
  editor.focus();
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
