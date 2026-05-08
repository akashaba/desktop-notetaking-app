import { DatabaseSync } from "node:sqlite";
import { v4 as uuidv4 } from "uuid";

export type NoteRecord = {
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

export type FolderRecord = {
  id: string;
  name: string;
  createdAt: string;
};

let db: DatabaseSync | null = null;

function getDb() {
  if (!db) {
    throw new Error("Database has not been initialized.");
  }

  return db;
}

export function initializeDatabase(databasePath: string) {
  db = new DatabaseSync(databasePath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      folderId TEXT,
      title TEXT NOT NULL,
      content TEXT,
      tags TEXT,
      isFavorite INTEGER NOT NULL DEFAULT 0,
      reminderAt TEXT,
      remindedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(folderId) REFERENCES folders(id)
    );
  `);

  ensureColumn("notes", "isFavorite", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("notes", "reminderAt", "TEXT");
  ensureColumn("notes", "remindedAt", "TEXT");
}

function ensureColumn(tableName: string, columnName: string, columnDefinition: string) {
  const columns = getDb()
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  getDb().exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}

export function createFolder(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Folder name is required.");
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `
        INSERT INTO folders (id, name, createdAt)
        VALUES (?, ?, ?)
      `
    )
    .run(id, trimmedName, now);

  return id;
}

export function getFolderList() {
  return getDb()
    .prepare("SELECT * FROM folders ORDER BY name ASC")
    .all() as FolderRecord[];
}

export function createNote(folderId?: string | null) {
  const id = uuidv4();
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `
        INSERT INTO notes (id, folderId, title, content, tags, isFavorite, reminderAt, remindedAt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(id, folderId ?? null, "Untitled Note", "", "", 0, null, null, now, now);

  return id;
}

export function getNoteList(search = "", folderId?: string | null) {
  let query = `
    SELECT * FROM notes
    WHERE 1 = 1
  `;

  const params: Array<string | null> = [];

  if (search.trim()) {
    query += ` AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (folderId) {
    query += ` AND folderId = ?`;
    params.push(folderId);
  }

  query += ` ORDER BY updatedAt DESC`;

  return getDb().prepare(query).all(...params) as NoteRecord[];
}

export function getNoteById(id: string) {
  return getDb().prepare("SELECT * FROM notes WHERE id = ?").get(id) as NoteRecord | null;
}

export function updateNote(note: NoteRecord) {
  const now = new Date().toISOString();
  const existingNote = getNoteById(note.id);
  const normalizedReminderAt = note.reminderAt ?? null;
  const nextRemindedAt =
    normalizedReminderAt && normalizedReminderAt === existingNote?.reminderAt
      ? note.remindedAt ?? existingNote?.remindedAt ?? null
      : null;

  getDb()
    .prepare(
      `
        UPDATE notes
        SET title = ?, content = ?, tags = ?, folderId = ?, isFavorite = ?, reminderAt = ?, remindedAt = ?, updatedAt = ?
        WHERE id = ?
      `
    )
    .run(
      note.title,
      note.content,
      note.tags,
      note.folderId ?? null,
      note.isFavorite ? 1 : 0,
      normalizedReminderAt,
      nextRemindedAt,
      now,
      note.id
    );
}

export function deleteNote(id: string) {
  getDb().prepare("DELETE FROM notes WHERE id = ?").run(id);
}

export function getDueReminderNotes(nowIso: string) {
  return getDb()
    .prepare(
      `
        SELECT * FROM notes
        WHERE reminderAt IS NOT NULL
          AND reminderAt <= ?
          AND remindedAt IS NULL
        ORDER BY reminderAt ASC
      `
    )
    .all(nowIso) as NoteRecord[];
}

export function markReminderShown(id: string, shownAtIso: string) {
  getDb()
    .prepare(
      `
        UPDATE notes
        SET remindedAt = ?, reminderAt = NULL
        WHERE id = ?
      `
    )
    .run(shownAtIso, id);
}