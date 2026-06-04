export type Note = {
  id: string;
  markdown: string;
  updatedAt: string;
};

export const UNTITLED_NOTE_TITLE = '無題';

const headingPattern = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;
const markdownLinkPattern = /\[[^\]]+\]\([^)]+\)/g;
const plainWebUrlPattern = /https?:\/\/[A-Za-z0-9\-._~:/?#@!$&'*+,;=%]+/g;
const trailingUrlPunctuationPattern = /[.,!?;:]+$/;
const listItemPattern = /^(\s*)([-*])\s+(?:\[(?: |x|X)\]\s+)?/;

type MovableNoteBlock = {
  start: number;
  end: number;
};

export type NoteLineRange = {
  startLineIndex: number;
  endLineIndex: number;
};

export type NoteLineMovement = 'up' | 'down' | 'start' | 'end';

export function createNote(markdown = '', id: string = crypto.randomUUID()): Note {
  return {
    id,
    markdown,
    updatedAt: new Date().toISOString()
  };
}

export function duplicateNote(source: Note, id: string = crypto.randomUUID()): Note {
  return createNote(source.markdown, id);
}

export function deriveNoteTitle(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const heading = lines.map((line) => line.match(headingPattern)?.[1]?.trim()).find(Boolean);

  if (heading) {
    return stripMarkdownChrome(heading);
  }

  const firstLine = lines.map((line) => line.trim()).find(Boolean);
  return firstLine ? stripMarkdownChrome(firstLine) : UNTITLED_NOTE_TITLE;
}

export function deriveNoteSnippet(markdown: string): string {
  const body = markdown
    .split(/\r?\n/)
    .map((line) => stripMarkdownChrome(line.trim()))
    .filter(Boolean)
    .join(' ');

  return body.length > 96 ? `${body.slice(0, 96).trimEnd()}...` : body;
}

export function sortNotesByUpdatedTime(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function matchesNoteSearch(note: Note, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return note.markdown.toLocaleLowerCase().includes(normalizedQuery);
}

export function normalizeSupportedMarkdown(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) =>
      normalizePlainLinks(
        line
          .replace(/^(\s*)\*\s+\[( |x|X)\]\s+/, (_, indent: string, marker: string) => {
            const checked = marker.toLowerCase() === 'x' ? 'x' : ' ';
            return `${indent}- [${checked}] `;
          })
          .replace(/^(\s*)-\s+\[(X)\]\s+/, '$1- [x] ')
          .replace(/^(\s*)\*\s+/, '$1- ')
      )
    )
    .join('\n');
}

export function toggleTaskAtIndex(markdown: string, taskIndex: number): string {
  let currentTaskIndex = -1;

  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(\s*)([-*])\s+\[( |x|X)\](\s+)/);
      if (!match) {
        return line;
      }

      currentTaskIndex += 1;
      if (currentTaskIndex !== taskIndex) {
        return line;
      }

      const [, indent, bullet, marker, trailingSpace] = match;
      const nextMarker = marker.toLowerCase() === 'x' ? ' ' : 'x';
      return line.replace(
        /^(\s*)([-*])\s+\[( |x|X)\](\s+)/,
        `${indent}${bullet} [${nextMarker}]${trailingSpace}`
      );
    })
    .join('\n');
}

export function moveNoteLine(
  markdown: string,
  lineIndex: number,
  movement: NoteLineMovement
): string {
  return moveNoteLines(markdown, { startLineIndex: lineIndex, endLineIndex: lineIndex }, movement);
}

export function moveNoteLines(
  markdown: string,
  lineRange: NoteLineRange,
  movement: NoteLineMovement
): string {
  return getNoteLineMovement(markdown, lineRange, movement)?.markdown ?? markdown;
}

export function getNoteLineMovementTargetRange(
  markdown: string,
  lineRange: NoteLineRange,
  movement: NoteLineMovement
): NoteLineRange | null {
  return getNoteLineMovement(markdown, lineRange, movement)?.range ?? null;
}

export function getNoteLineMovementTargetIndex(
  markdown: string,
  lineIndex: number,
  movement: NoteLineMovement
): number {
  const targetRange = getNoteLineMovementTargetRange(
    markdown,
    { startLineIndex: lineIndex, endLineIndex: lineIndex },
    movement
  );
  if (!targetRange) {
    return -1;
  }

  const lines = markdown.split(/\r?\n/);
  const blocks = getMovableNoteBlocks(lines);
  const currentBlockIndex = getMovableNoteBlockIndex(blocks, lineIndex);
  const currentBlock = blocks[currentBlockIndex];
  const lineOffsetInBlock = lineIndex - currentBlock.start;
  return targetRange.startLineIndex + lineOffsetInBlock;
}

function getNoteLineMovement(
  markdown: string,
  lineRange: NoteLineRange,
  movement: NoteLineMovement
): { markdown: string; range: NoteLineRange } | null {
  const lines = markdown.split(/\r?\n/);
  const blocks = getMovableNoteBlocks(lines);
  const selectedBlockIndexes = getMovableNoteBlockIndexesInRange(blocks, lineRange);

  if (selectedBlockIndexes.length === 0) {
    return null;
  }

  const firstSelectedBlockIndex = selectedBlockIndexes[0];
  const lastSelectedBlockIndex = selectedBlockIndexes[selectedBlockIndexes.length - 1];
  const selectedIndexSet = new Set(selectedBlockIndexes);
  const selectedBlocks = blocks.filter((_, index) => selectedIndexSet.has(index));
  const nextBlocks = blocks.filter((_, index) => !selectedIndexSet.has(index));
  const insertBlockIndex = getNoteLineMovementInsertBlockIndex(
    blocks,
    nextBlocks,
    selectedBlockIndexes,
    firstSelectedBlockIndex,
    lastSelectedBlockIndex,
    movement
  );

  if (insertBlockIndex === null) {
    return null;
  }

  nextBlocks.splice(insertBlockIndex, 0, ...selectedBlocks);

  const nextLines: string[] = [];
  const selectedNextStarts: number[] = [];
  const selectedNextEnds: number[] = [];

  for (let blockIndex = 0; blockIndex < nextBlocks.length; blockIndex += 1) {
    const block = nextBlocks[blockIndex];
    const gapStart = blockIndex === 0 ? 0 : blocks[blockIndex - 1].end;
    const gapEnd = blockIndex === 0 ? blocks[0].start : blocks[blockIndex].start;

    nextLines.push(...lines.slice(gapStart, gapEnd));
    const nextStart = nextLines.length;
    nextLines.push(...lines.slice(block.start, block.end));
    const nextEnd = nextLines.length;

    if (selectedBlocks.includes(block)) {
      selectedNextStarts.push(nextStart);
      selectedNextEnds.push(nextEnd);
    }
  }

  const lastBlock = blocks.at(-1);
  if (lastBlock) {
    nextLines.push(...lines.slice(lastBlock.end));
  }

  return {
    markdown: nextLines.join('\n'),
    range: {
      startLineIndex: Math.min(...selectedNextStarts),
      endLineIndex: Math.max(...selectedNextEnds) - 1
    }
  };
}

function getNoteLineMovementInsertBlockIndex(
  blocks: MovableNoteBlock[],
  nextBlocks: MovableNoteBlock[],
  selectedBlockIndexes: number[],
  firstSelectedBlockIndex: number,
  lastSelectedBlockIndex: number,
  movement: NoteLineMovement
): number | null {
  if (movement === 'start') {
    return firstSelectedBlockIndex === 0 ? null : 0;
  }

  if (movement === 'end') {
    return lastSelectedBlockIndex === blocks.length - 1 ? null : nextBlocks.length;
  }

  const targetBlockIndex =
    movement === 'up' ? firstSelectedBlockIndex - 1 : lastSelectedBlockIndex + 1;

  if (targetBlockIndex < 0 || targetBlockIndex >= blocks.length) {
    return null;
  }

  const selectedIndexSet = new Set(selectedBlockIndexes);
  if (selectedIndexSet.has(targetBlockIndex)) {
    return null;
  }

  const targetBlock = blocks[targetBlockIndex];
  const nextTargetBlockIndex = nextBlocks.indexOf(targetBlock);
  return movement === 'up' ? nextTargetBlockIndex : nextTargetBlockIndex + 1;
}

function stripMarkdownChrome(value: string): string {
  return value
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/^\s*-\s+\[(?: |x|X)\]\s+/, '')
    .replace(/^\s*\*\s+\[(?: |x|X)\]\s+/, '')
    .replace(/^\s*-\s+/, '')
    .replace(/^\s*\*\s+/, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePlainLinks(line: string): string {
  const markdownLinkRanges = getMarkdownLinkRanges(line);

  return line.replace(plainWebUrlPattern, (rawUrl, offset) => {
    if (isInsideRange(offset, markdownLinkRanges) || isAngleBracketAutolink(line, offset, rawUrl)) {
      return rawUrl;
    }

    const punctuation = rawUrl.match(trailingUrlPunctuationPattern)?.[0] ?? '';
    const url = punctuation ? rawUrl.slice(0, -punctuation.length) : rawUrl;
    return `[${url}](${url})${punctuation}`;
  });
}

function getMarkdownLinkRanges(line: string): Array<{ start: number; end: number }> {
  return Array.from(line.matchAll(markdownLinkPattern), (match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length
  }));
}

function isInsideRange(offset: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some((range) => offset >= range.start && offset < range.end);
}

function isAngleBracketAutolink(line: string, offset: number, rawUrl: string): boolean {
  return line[offset - 1] === '<' && line[offset + rawUrl.length] === '>';
}

function getMovableNoteBlocks(lines: string[]): MovableNoteBlock[] {
  const blocks: MovableNoteBlock[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    if (isBlankNoteLine(lines[lineIndex])) {
      lineIndex += 1;
      continue;
    }

    const start = lineIndex;
    const listItem = lines[lineIndex].match(listItemPattern);
    lineIndex += 1;

    if (listItem) {
      const listItemIndent = listItem[1].length;
      while (
        lineIndex < lines.length &&
        isListItemContinuationLine(lines[lineIndex], listItemIndent)
      ) {
        lineIndex += 1;
      }
    }

    blocks.push({ start, end: lineIndex });
  }

  return blocks;
}

function getMovableNoteBlockIndex(blocks: MovableNoteBlock[], lineIndex: number): number {
  return blocks.findIndex((block) => lineIndex >= block.start && lineIndex < block.end);
}

function getMovableNoteBlockIndexesInRange(
  blocks: MovableNoteBlock[],
  lineRange: NoteLineRange
): number[] {
  const startLineIndex = Math.min(lineRange.startLineIndex, lineRange.endLineIndex);
  const endLineIndex = Math.max(lineRange.startLineIndex, lineRange.endLineIndex);

  return blocks.flatMap((block, index) =>
    block.start <= endLineIndex && block.end > startLineIndex ? [index] : []
  );
}

function isListItemContinuationLine(line: string, listItemIndent: number): boolean {
  if (isBlankNoteLine(line) || listItemPattern.test(line)) {
    return false;
  }

  return getIndentLength(line) > listItemIndent;
}

function getIndentLength(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function isBlankNoteLine(line: string): boolean {
  return line.trim() === '';
}
