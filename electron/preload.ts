import { contextBridge, ipcRenderer } from "electron";
import type { FolderRecord, NoteRecord } from "./sqliteService.ts";

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
  },
});