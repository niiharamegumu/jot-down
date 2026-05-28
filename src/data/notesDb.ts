import Dexie, { type EntityTable } from 'dexie';
import type { Note } from '../domain/note';
import type { NoteTemplate } from '../domain/noteTemplate';

class JotDownDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>;
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

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
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
