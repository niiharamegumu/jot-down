export type TaskSelectionSnapshot = {
  noteId: string;
  taskIndex: number;
  offset: number;
  scrollPositions: ScrollPositionSnapshot[];
};

type ScrollPositionSnapshot = {
  target: Element;
  top: number;
  left: number;
};

export function captureTaskSelectionSnapshot(
  noteId: string,
  taskIndex: number,
  checkbox: HTMLElement
): TaskSelectionSnapshot {
  const selection = window.getSelection();
  const selectedNode = selection?.anchorNode;
  const offset =
    selectedNode && checkbox.contains(selectedNode)
      ? getTextOffset(checkbox, selectedNode, selection.anchorOffset)
      : 0;

  return {
    noteId,
    taskIndex,
    offset,
    scrollPositions: captureScrollPositions(checkbox)
  };
}

export function restoreTaskSelectionSnapshot(
  snapshot: TaskSelectionSnapshot,
  getCurrentNoteId: () => string | null,
  checkbox: HTMLElement | null,
  scheduleAnimationFrame: typeof window.requestAnimationFrame = window.requestAnimationFrame
) {
  if (snapshot.noteId !== getCurrentNoteId() || !checkbox) {
    return;
  }

  restoreScrollPositions(snapshot.scrollPositions);
  focusWithoutScrolling(checkbox);

  const position = findTextPosition(checkbox, snapshot.offset);
  const range = document.createRange();
  range.setStart(position.node, position.offset);
  range.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  restoreScrollPositions(snapshot.scrollPositions);
  scheduleAnimationFrame(() => {
    if (snapshot.noteId === getCurrentNoteId()) {
      restoreScrollPositions(snapshot.scrollPositions);
    }
  });
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

function getTextOffset(root: Node, target: Node, targetOffset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node === target) {
      return offset + targetOffset;
    }

    offset += node.textContent?.length ?? 0;
  }

  return offset;
}

function findTextPosition(root: Node, targetOffset: number): { node: Node; offset: number } {
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
