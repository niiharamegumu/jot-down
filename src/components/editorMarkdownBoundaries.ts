const listBoundaryComment = '<!-- jot-down:list-boundary -->';

export function addEditorOnlyListBoundaries(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const nextLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
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

function isBlankLine(line: string): boolean {
  return line.trim() === '';
}

function isTaskListLine(line: string): boolean {
  return /^\s*[-*]\s+\[(?: |x|X)\]\s+/.test(line);
}

function isPlainListLine(line: string): boolean {
  return /^\s*[-*]\s+/.test(line) && !isTaskListLine(line);
}
