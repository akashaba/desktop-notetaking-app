// src/features/notes/notesService.ts
export type Note = {
  id: string;
  folderId?: string | null;
  title: string;
  content: string;
  tags: string;
  isFavorite?: number | boolean;
  reminderAt?: string | null;
  remindedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function createNote(folderId?: string | null) {
  return window.notesApi.notes.create(folderId);
}

export function getNotes(search = "", folderId?: string | null) {
  return window.notesApi.notes.list(search, folderId);
}

export function getNoteById(id: string) {
  return window.notesApi.notes.getById(id);
}

export function updateNote(note: Note) {
  return window.notesApi.notes.update(note);
}

export function deleteNote(id: string) {
  return window.notesApi.notes.delete(id);
}