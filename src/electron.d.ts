type NoteRecord = {
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

type ReminderRecord = {
  id: string;
  noteId: string;
  date: string;
  time: string;
  repeat: "once" | "daily" | "weekly" | "monthly" | "yearly";
  notificationOffset: "at_time" | "5_min_before" | "10_min_before" | "30_min_before" | "1_hour_before";
  message: string;
  status: "active" | "triggered" | "cancelled";
  createdAt: string;
  triggeredAt?: string | null;
  snoozedUntil?: string | null;
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
        restore: (id: string) => Promise<void>;
        purge: (id: string) => Promise<void>;
      };
      reminders: {
        listByNote: (noteId: string) => Promise<ReminderRecord[]>;
        upsert: (reminder: ReminderRecord) => Promise<void>;
        delete: (reminderId: string) => Promise<void>;
        snooze: (reminderId: string, snoozedUntilIso: string) => Promise<void>;
        onDue: (callback: (payload: { reminder: ReminderRecord; noteId: string; noteTitle: string }) => void) => () => void;
        onOpenNote: (callback: (noteId: string) => void) => () => void;
      };
      assets: {
        import: (fileName: string, dataUrl: string) => Promise<string>;
        open: (assetPath: string) => Promise<string>;
      };
    };
  }
}

export {};