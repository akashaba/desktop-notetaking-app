import { app, BrowserWindow, Notification, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFolder,
  createNote,
  deleteNote,
  deleteReminder,
  permanentlyDeleteNote,
  restoreNote,
  getDueReminders,
  getFolderList,
  getNoteById,
  getNoteList,
  importAsset,
  initializeDatabase,
  listRemindersByNote,
  markReminderTriggered,
  snoozeReminder,
  upsertReminder,
  updateNote,
  type DueReminderRecord,
  type NoteRecord,
  type ReminderRecord,
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
  ipcMain.handle("notes:restore", (_event, id: string) => restoreNote(id));
  ipcMain.handle("notes:purge", (_event, id: string) => permanentlyDeleteNote(id));
  ipcMain.handle("reminders:listByNote", (_event, noteId: string) => listRemindersByNote(noteId));
  ipcMain.handle("reminders:upsert", (_event, reminder: ReminderRecord) => upsertReminder(reminder));
  ipcMain.handle("reminders:delete", (_event, reminderId: string) => deleteReminder(reminderId));
  ipcMain.handle("reminders:snooze", (_event, reminderId: string, snoozedUntilIso: string) =>
    snoozeReminder(reminderId, snoozedUntilIso)
  );
  ipcMain.handle("assets:import", (_event, fileName: string, dataUrl: string) =>
    importAsset(fileName, dataUrl)
  );
  ipcMain.handle("assets:open", (_event, assetPath: string) => shell.openPath(assetPath));
}

function createWindow() {
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
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

function focusNote(noteId: string) {
  const existingWindow = BrowserWindow.getAllWindows()[0];

  if (!existingWindow) {
    return;
  }

  if (existingWindow.isMinimized()) {
    existingWindow.restore();
  }

  existingWindow.focus();
  existingWindow.webContents.send("reminders:open-note", noteId);
}

function showReminder(entry: DueReminderRecord) {
  shell.beep();
  const notification = new Notification({
    title: entry.note.title || "Untitled Note",
    body: entry.reminder.message || entry.note.content.trim() || "You asked to be reminded about this note.",
  });

  notification.on("click", () => {
    focusNote(entry.note.id);
  });

  notification.show();

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("reminders:due", {
      reminder: entry.reminder,
      noteId: entry.note.id,
      noteTitle: entry.note.title,
    });
  }
}

function checkDueReminders() {
  const nowIso = new Date().toISOString();
  const dueEntries = getDueReminders(nowIso);

  for (const entry of dueEntries) {
    showReminder(entry);
    markReminderTriggered(entry.reminder.id, nowIso);
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