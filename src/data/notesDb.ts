import Dexie, { type EntityTable } from 'dexie';
import type { Note } from '../domain/note';

class JotDownDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>;

  constructor() {
    super('jot-down');
    this.version(1).stores({
      notes: 'id, updatedAt'
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
