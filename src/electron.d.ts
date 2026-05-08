type NoteRecord = {
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

type FolderRecord = {
  id: string;
  name: string;
  createdAt: string;
};

declare global {
  interface Window {
    notesApi: {
      folders: {
        list: () => Promise<FolderRecord[]>;
        create: (name: string) => Promise<string>;
      };
      notes: {
        list: (search?: string, folderId?: string | null) => Promise<NoteRecord[]>;
        getById: (id: string) => Promise<NoteRecord | null>;
        create: (folderId?: string | null) => Promise<string>;
        update: (note: NoteRecord) => Promise<void>;
        delete: (id: string) => Promise<void>;
      };
    };
  }
}

export {};