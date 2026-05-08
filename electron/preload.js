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
  },
});