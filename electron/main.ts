import { app, BrowserWindow, Notification, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFolder,
  createNote,
  deleteNote,
  getDueReminderNotes,
  getFolderList,
  getNoteById,
  getNoteList,
  initializeDatabase,
  markReminderShown,
  updateNote,
  type NoteRecord,
} from "./sqliteService.ts";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";

function registerIpcHandlers() {
  ipcMain.handle("folders:list", () => getFolderList());
  ipcMain.handle("folders:create", (_event, name: string) => createFolder(name));
  ipcMain.handle("notes:list", (_event, search: string, folderId?: string | null) =>
    getNoteList(search, folderId)
  );
  ipcMain.handle("notes:getById", (_event, id: string) => getNoteById(id));
  ipcMain.handle("notes:create", (_event, folderId?: string | null) => createNote(folderId));
  ipcMain.handle("notes:update", (_event, note: NoteRecord) => updateNote(note));
  ipcMain.handle("notes:delete", (_event, id: string) => deleteNote(id));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(currentDirPath, "preload.js"),
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(currentDirPath, "..", "dist", "index.html"));
    return;
  }

  win.loadURL(devServerUrl);
}

function showReminder(note: NoteRecord) {
  new Notification({
    title: note.title || "Untitled Note",
    body: note.content.trim() || "You asked to be reminded about this note.",
  }).show();
}

function checkDueReminders() {
  const nowIso = new Date().toISOString();
  const dueNotes = getDueReminderNotes(nowIso);

  for (const note of dueNotes) {
    showReminder(note);
    markReminderShown(note.id, nowIso);
  }
}

app.whenReady().then(() => {
  initializeDatabase(path.join(app.getPath("userData"), "notes.db"));
  app.setPath("sessionData", path.join(app.getPath("userData"), "session-data"));
  registerIpcHandlers();
  checkDueReminders();
  setInterval(checkDueReminders, 30000);
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});