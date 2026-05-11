import { contextBridge, ipcRenderer } from "electron";
import type { FolderRecord, NoteRecord, ReminderRecord } from "./sqliteService.ts";

contextBridge.exposeInMainWorld("notesApi", {
  folders: {
    list: () => ipcRenderer.invoke("folders:list") as Promise<FolderRecord[]>,
    create: (name: string) => ipcRenderer.invoke("folders:create", name) as Promise<string>,
  },
  notes: {
    list: (search = "", folderId?: string | null) =>
      ipcRenderer.invoke("notes:list", search, folderId) as Promise<NoteRecord[]>,
    getById: (id: string) => ipcRenderer.invoke("notes:getById", id) as Promise<NoteRecord | null>,
    create: (folderId?: string | null) =>
      ipcRenderer.invoke("notes:create", folderId) as Promise<string>,
    update: (note: NoteRecord) => ipcRenderer.invoke("notes:update", note) as Promise<void>,
    delete: (id: string) => ipcRenderer.invoke("notes:delete", id) as Promise<void>,
    restore: (id: string) => ipcRenderer.invoke("notes:restore", id) as Promise<void>,
    purge: (id: string) => ipcRenderer.invoke("notes:purge", id) as Promise<void>,
  },
  reminders: {
    listByNote: (noteId: string) =>
      ipcRenderer.invoke("reminders:listByNote", noteId) as Promise<ReminderRecord[]>,
    upsert: (reminder: ReminderRecord) =>
      ipcRenderer.invoke("reminders:upsert", reminder) as Promise<void>,
    delete: (reminderId: string) => ipcRenderer.invoke("reminders:delete", reminderId) as Promise<void>,
    snooze: (reminderId: string, snoozedUntilIso: string) =>
      ipcRenderer.invoke("reminders:snooze", reminderId, snoozedUntilIso) as Promise<void>,
    onDue: (callback: (payload: { reminder: ReminderRecord; noteId: string; noteTitle: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { reminder: ReminderRecord; noteId: string; noteTitle: string }) => {
        callback(payload);
      };

      ipcRenderer.on("reminders:due", listener);

      return () => {
        ipcRenderer.removeListener("reminders:due", listener);
      };
    },
    onOpenNote: (callback: (noteId: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, noteId: string) => {
        callback(noteId);
      };

      ipcRenderer.on("reminders:open-note", listener);

      return () => {
        ipcRenderer.removeListener("reminders:open-note", listener);
      };
    },
  },
  assets: {
    import: (fileName: string, dataUrl: string) =>
      ipcRenderer.invoke("assets:import", fileName, dataUrl) as Promise<string>,
    open: (assetPath: string) => ipcRenderer.invoke("assets:open", assetPath) as Promise<string>,
  },
});