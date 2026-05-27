export type Note = {
  id: string;
  markdown: string;
  updatedAt: string;
};

export const UNTITLED_NOTE_TITLE = '無題';

const headingPattern = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;

export function createNote(markdown = '', id: string = crypto.randomUUID()): Note {
  return {
    id,
    markdown,
    updatedAt: new Date().toISOString()
  };
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
      line
        .replace(/^(\s*)\*\s+\[( |x|X)\]\s+/, (_, indent: string, marker: string) => {
          const checked = marker.toLowerCase() === 'x' ? 'x' : ' ';
          return `${indent}- [${checked}] `;
        })
        .replace(/^(\s*)-\s+\[(X)\]\s+/, '$1- [x] ')
        .replace(/^(\s*)\*\s+/, '$1- ')
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

function stripMarkdownChrome(value: string): string {
  return value
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/^\s*-\s+\[(?: |x|X)\]\s+/, '')
    .replace(/^\s*\*\s+\[(?: |x|X)\]\s+/, '')
    .replace(/^\s*-\s+/, '')
    .replace(/^\s*\*\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
