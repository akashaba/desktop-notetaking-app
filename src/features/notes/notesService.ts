// src/features/notes/notesService.ts
export type Note = {
  id: string;
  folderId?: string | null;
  title: string;
  content: string;
  tags: string;
  isFavorite?: number | boolean;
  objects?: string | null;
  drawingData?: string | null;
  attachmentsData?: string | null;
  attachmentThumbnailsData?: string | null;
  deleted?: number | boolean;
  reminderAt?: string | null;
  remindedAt?: string | null;
  deletedAt?: string | null;
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

export function restoreNote(id: string) {
  return window.notesApi.notes.restore(id);
}

export function purgeNote(id: string) {
  return window.notesApi.notes.purge(id);
}