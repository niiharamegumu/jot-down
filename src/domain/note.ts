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
  direction: 'up' | 'down'
): string {
  const lines = markdown.split(/\r?\n/);
  const targetIndex = getNoteLineMovementTargetIndex(markdown, lineIndex, direction);
  if (targetIndex < 0) {
    return markdown;
  }

  const nextLines = [...lines];
  const movingLine = nextLines[lineIndex];
  nextLines[lineIndex] = nextLines[targetIndex];
  nextLines[targetIndex] = movingLine;

  return nextLines.join('\n');
}

export function getNoteLineMovementTargetIndex(
  markdown: string,
  lineIndex: number,
  direction: 'up' | 'down'
): number {
  const lines = markdown.split(/\r?\n/);

  if (lineIndex < 0 || lineIndex >= lines.length || isBlankNoteLine(lines[lineIndex])) {
    return -1;
  }

  return findMovableNoteLineTargetIndex(lines, lineIndex, direction);
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

function findMovableNoteLineTargetIndex(
  lines: string[],
  lineIndex: number,
  direction: 'up' | 'down'
): number {
  const step = direction === 'up' ? -1 : 1;
  for (let index = lineIndex + step; index >= 0 && index < lines.length; index += step) {
    if (!isBlankNoteLine(lines[index])) {
      return index;
    }
  }

  return -1;
}

function isBlankNoteLine(line: string): boolean {
  return line.trim() === '';
}
