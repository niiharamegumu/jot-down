import Dexie, { type EntityTable } from 'dexie';
import type { Note } from '../domain/note';
import type { NoteFolder } from '../domain/noteFolder';
import type { NoteTemplate } from '../domain/noteTemplate';

class JotDownDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>;
  noteFolders!: EntityTable<NoteFolder, 'id'>;
  noteTemplates!: EntityTable<NoteTemplate, 'id'>;

  constructor() {
    super('jot-down');
    this.version(1).stores({
      notes: 'id, updatedAt'
    });
    this.version(2).stores({
      notes: 'id, updatedAt',
      noteTemplates: 'id, name, updatedAt'
    });
    this.version(3).stores({
      notes: 'id, updatedAt, folderId',
      noteFolders: 'id, name',
      noteTemplates: 'id, name, updatedAt'
    });
  }
}

export const db = new JotDownDatabase();

export async function loadNotes(): Promise<Note[]> {
  await db.open();
  return db.notes.orderBy('updatedAt').reverse().toArray();
}

export async function putNote(note: Note): Promise<void> {
  await db.notes.put(note);
}

export async function putNotes(notes: Note[]): Promise<void> {
  await db.notes.bulkPut(notes);
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

export async function deleteNotes(ids: string[]): Promise<void> {
  await db.transaction('rw', db.notes, async () => {
    await db.notes.bulkDelete(ids);
  });
}

export async function loadNoteFolders(): Promise<NoteFolder[]> {
  await db.open();
  return db.noteFolders.orderBy('name').toArray();
}

export async function putNoteFolder(folder: NoteFolder): Promise<void> {
  await db.noteFolders.put(folder);
}

export async function deleteNoteFolderAndNotes(folderId: string, noteIds: string[]): Promise<void> {
  await db.transaction('rw', db.noteFolders, db.notes, async () => {
    await db.notes.bulkDelete(noteIds);
    await db.noteFolders.delete(folderId);
  });
}

export async function loadNoteTemplates(): Promise<NoteTemplate[]> {
  await db.open();
  return db.noteTemplates.orderBy('name').toArray();
}

export async function putNoteTemplate(template: NoteTemplate): Promise<void> {
  await db.noteTemplates.put(template);
}

export async function deleteNoteTemplate(id: string): Promise<void> {
  await db.noteTemplates.delete(id);
}
