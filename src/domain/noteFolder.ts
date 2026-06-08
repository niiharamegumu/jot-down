export type NoteFolder = {
  id: string;
  name: string;
};

const noteFolderNameCollator = new Intl.Collator('ja-JP', {
  sensitivity: 'accent',
  numeric: true
});

export function createNoteFolder(name: string, id: string = crypto.randomUUID()): NoteFolder {
  return {
    id,
    name: normalizeNoteFolderName(name)
  };
}

export function normalizeNoteFolderName(name: string): string {
  return name.trim();
}

export function getNoteFolderNameKey(name: string): string {
  return normalizeNoteFolderName(name).toLocaleLowerCase('ja-JP');
}

export function isValidNoteFolderName(name: string): boolean {
  return normalizeNoteFolderName(name).length > 0;
}

export function isUniqueNoteFolderName(
  name: string,
  folders: NoteFolder[],
  ignoredFolderId: string | null = null
): boolean {
  const nameKey = getNoteFolderNameKey(name);
  return folders.every(
    (folder) => folder.id === ignoredFolderId || getNoteFolderNameKey(folder.name) !== nameKey
  );
}

export function sortNoteFoldersByName(folders: NoteFolder[]): NoteFolder[] {
  return [...folders].sort((a, b) => noteFolderNameCollator.compare(a.name, b.name));
}
