const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notesApi", {
  folders: {
    list: () => ipcRenderer.invoke("folders:list"),
    create: (name) => ipcRenderer.invoke("folders:create", name),
  },
  notes: {
    list: (search = "", folderId) => ipcRenderer.invoke("notes:list", search, folderId),
    getById: (id) => ipcRenderer.invoke("notes:getById", id),
    create: (folderId) => ipcRenderer.invoke("notes:create", folderId),
    update: (note) => ipcRenderer.invoke("notes:update", note),
    delete: (id) => ipcRenderer.invoke("notes:delete", id),
    restore: (id) => ipcRenderer.invoke("notes:restore", id),
    purge: (id) => ipcRenderer.invoke("notes:purge", id),
  },
  reminders: {
    listByNote: (noteId) => ipcRenderer.invoke("reminders:listByNote", noteId),
    upsert: (reminder) => ipcRenderer.invoke("reminders:upsert", reminder),
    delete: (reminderId) => ipcRenderer.invoke("reminders:delete", reminderId),
    snooze: (reminderId, snoozedUntilIso) =>
      ipcRenderer.invoke("reminders:snooze", reminderId, snoozedUntilIso),
    onDue: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("reminders:due", listener);
      return () => ipcRenderer.removeListener("reminders:due", listener);
    },
    onOpenNote: (callback) => {
      const listener = (_event, noteId) => callback(noteId);
      ipcRenderer.on("reminders:open-note", listener);
      return () => ipcRenderer.removeListener("reminders:open-note", listener);
    },
  },
  assets: {
    import: (fileName, dataUrl) => ipcRenderer.invoke("assets:import", fileName, dataUrl),
    open: (assetPath) => ipcRenderer.invoke("assets:open", assetPath),
  },
});