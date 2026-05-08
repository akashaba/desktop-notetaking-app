// src/features/folders/foldersService.ts
export type Folder = {
  id: string;
  name: string;
  createdAt: string;
};

export function createFolder(name: string) {
  return window.notesApi.folders.create(name);
}

export function getFolders() {
  return window.notesApi.folders.list();
}