const listBoundaryComment = '<!-- jot-down:list-boundary -->';
const listItemPattern = /^(\s*)([-*])\s+(?:\[(?: |x|X)\]\s+)?/;

export function addEditorOnlyListBoundaries(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const nextLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (shouldInsertBoundaryBeforeLine(lines, index)) {
      nextLines.push(listBoundaryComment);
    }

    nextLines.push(lines[index]);

    if (!isBlankLine(lines[index])) {
      continue;
    }

    const previousListKind = getAdjacentListKind(lines, index, 'previous');
    const nextListKind = getAdjacentListKind(lines, index, 'next');
    if (!shouldSeparateListKinds(previousListKind, nextListKind)) {
      continue;
    }

    if (lines[index + 1] === listBoundaryComment) {
      continue;
    }

    nextLines.push(listBoundaryComment);
  }

  return nextLines.join('\n');
}

export function removeEditorOnlyListBoundaries(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.trim() !== listBoundaryComment)
    .join('\n');
}

type ListKind = 'task' | 'plain' | 'mixed' | 'none';

function getAdjacentListKind(
  lines: string[],
  blankLineIndex: number,
  direction: 'previous' | 'next'
): ListKind {
  const step = direction === 'previous' ? -1 : 1;
  let index = blankLineIndex + step;

  while (index >= 0 && index < lines.length && isBlankLine(lines[index])) {
    index += step;
  }

  let hasTask = false;
  let hasPlain = false;

  while (index >= 0 && index < lines.length && !isBlankLine(lines[index])) {
    const line = lines[index];
    if (isTaskListLine(line)) {
      hasTask = true;
    } else if (isPlainListLine(line)) {
      hasPlain = true;
    } else {
      return 'none';
    }

    index += step;
  }

  if (hasTask && hasPlain) {
    return 'mixed';
  }
  if (hasTask) {
    return 'task';
  }
  if (hasPlain) {
    return 'plain';
  }
  return 'none';
}

function shouldSeparateListKinds(left: ListKind, right: ListKind): boolean {
  return (
    left !== 'none' && right !== 'none' && (left === 'mixed' || right === 'mixed' || left !== right)
  );
}

function shouldInsertBoundaryBeforeLine(lines: string[], index: number): boolean {
  if (
    index === 0 ||
    lines[index] === listBoundaryComment ||
    lines[index - 1] === listBoundaryComment
  ) {
    return false;
  }

  const previousLine = lines[index - 1];
  const currentLine = lines[index];
  if (isBlankLine(previousLine) || isBlankLine(currentLine)) {
    return false;
  }

  const previousListKind = getLineListKind(previousLine);
  const currentListKind = getLineListKind(currentLine);
  const previousContinuationListKind = getContinuationListKind(lines, index - 1);
  if (
    previousListKind !== 'none' &&
    currentListKind === 'none' &&
    !isListItemContinuationLine(previousLine, currentLine)
  ) {
    return true;
  }

  if (previousContinuationListKind !== 'none' && currentListKind !== 'none') {
    return shouldSeparateListKinds(previousContinuationListKind, currentListKind);
  }

  return shouldSeparateListKinds(previousListKind, currentListKind);
}

function getLineListKind(line: string): ListKind {
  if (isTaskListLine(line)) {
    return 'task';
  }

  if (isPlainListLine(line)) {
    return 'plain';
  }

  return 'none';
}

function isListItemContinuationLine(listLine: string, line: string): boolean {
  const listItem = listLine.match(listItemPattern);
  if (!listItem || isBlankLine(line) || listItemPattern.test(line)) {
    return false;
  }

  return getIndentLength(line) > listItem[1].length;
}

function getContinuationListKind(lines: string[], lineIndex: number): ListKind {
  const line = lines[lineIndex];
  if (isBlankLine(line) || listItemPattern.test(line)) {
    return 'none';
  }

  const indent = getIndentLength(line);
  for (let index = lineIndex - 1; index >= 0; index -= 1) {
    if (isBlankLine(lines[index]) || lines[index] === listBoundaryComment) {
      return 'none';
    }

    const listItem = lines[index].match(listItemPattern);
    if (!listItem) {
      continue;
    }

    return indent > listItem[1].length ? getLineListKind(lines[index]) : 'none';
  }

  return 'none';
}

function getIndentLength(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function isBlankLine(line: string): boolean {
  return line.trim() === '';
}

function isTaskListLine(line: string): boolean {
  return /^\s*[-*]\s+\[(?: |x|X)\]\s+/.test(line);
}

function isPlainListLine(line: string): boolean {
  return /^\s*[-*]\s+/.test(line) && !isTaskListLine(line);
}
