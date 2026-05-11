import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { v4 as uuidv4 } from "uuid";

export type NoteRecord = {
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

export type ReminderRepeatRule = "once" | "daily" | "weekly" | "monthly" | "yearly";
export type ReminderNotificationOffset =
  | "at_time"
  | "5_min_before"
  | "10_min_before"
  | "30_min_before"
  | "1_hour_before";
export type ReminderStatus = "active" | "triggered" | "cancelled";

export type ReminderRecord = {
  id: string;
  noteId: string;
  date: string;
  time: string;
  repeat: ReminderRepeatRule;
  notificationOffset: ReminderNotificationOffset;
  message: string;
  status: ReminderStatus;
  createdAt: string;
  triggeredAt?: string | null;
  snoozedUntil?: string | null;
};

export type DueReminderRecord = {
  reminder: ReminderRecord;
  note: NoteRecord;
};

export type FolderRecord = {
  id: string;
  name: string;
  createdAt: string;
};

let db: DatabaseSync | null = null;
let assetsDirPath = "";

function getDb() {
  if (!db) {
    throw new Error("Database has not been initialized.");
  }

  return db;
}

export function initializeDatabase(databasePath: string) {
  db = new DatabaseSync(databasePath);
  assetsDirPath = path.join(path.dirname(databasePath), "note-assets");
  fs.mkdirSync(assetsDirPath, { recursive: true });

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
      objects TEXT,
      drawingData TEXT,
      attachmentsData TEXT,
      attachmentThumbnailsData TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      reminderAt TEXT,
      remindedAt TEXT,
      deletedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(folderId) REFERENCES folders(id)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      noteId TEXT NOT NULL,
      reminderDate TEXT NOT NULL,
      reminderTime TEXT NOT NULL,
      repeatRule TEXT NOT NULL DEFAULT 'once',
      notificationOffset TEXT NOT NULL DEFAULT 'at_time',
      message TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      triggeredAt TEXT,
      snoozedUntil TEXT,
      FOREIGN KEY(noteId) REFERENCES notes(id)
    );
  `);

  ensureColumn("notes", "isFavorite", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("notes", "objects", "TEXT");
  ensureColumn("notes", "drawingData", "TEXT");
  ensureColumn("notes", "attachmentsData", "TEXT");
  ensureColumn("notes", "attachmentThumbnailsData", "TEXT");
  ensureColumn("notes", "deleted", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("notes", "reminderAt", "TEXT");
  ensureColumn("notes", "remindedAt", "TEXT");
  ensureColumn("notes", "deletedAt", "TEXT");
  ensureColumn("reminders", "triggeredAt", "TEXT");
  ensureColumn("reminders", "snoozedUntil", "TEXT");
}

function getOffsetMs(offset: ReminderNotificationOffset) {
  switch (offset) {
    case "5_min_before":
      return 5 * 60 * 1000;
    case "10_min_before":
      return 10 * 60 * 1000;
    case "30_min_before":
      return 30 * 60 * 1000;
    case "1_hour_before":
      return 60 * 60 * 1000;
    default:
      return 0;
  }
}

function computeReminderBaseTime(reminder: ReminderRecord) {
  return new Date(`${reminder.date}T${reminder.time}:00`).getTime();
}

function computeReminderTriggerIso(reminder: ReminderRecord) {
  if (reminder.snoozedUntil) {
    return reminder.snoozedUntil;
  }

  return new Date(computeReminderBaseTime(reminder) - getOffsetMs(reminder.notificationOffset)).toISOString();
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

function computeNextOccurrence(reminder: ReminderRecord) {
  const current = new Date(`${reminder.date}T${reminder.time}:00`);
  let next = new Date(current);

  switch (reminder.repeat) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next = addMonths(next, 1);
      break;
    case "yearly":
      next = addMonths(next, 12);
      break;
    default:
      return null;
  }

  return {
    date: next.toISOString().slice(0, 10),
    time: next.toTimeString().slice(0, 5),
  };
}

function mapReminderRecord(rawRecord: Record<string, unknown>) {
  return {
    id: String(rawRecord.id),
    noteId: String(rawRecord.noteId),
    date: String(rawRecord.date),
    time: String(rawRecord.time),
    repeat: String(rawRecord.repeat) as ReminderRepeatRule,
    notificationOffset: String(rawRecord.notificationOffset) as ReminderNotificationOffset,
    message: typeof rawRecord.message === "string" ? rawRecord.message : "",
    status: String(rawRecord.status) as ReminderStatus,
    createdAt: String(rawRecord.createdAt),
    triggeredAt: typeof rawRecord.triggeredAt === "string" ? rawRecord.triggeredAt : null,
    snoozedUntil: typeof rawRecord.snoozedUntil === "string" ? rawRecord.snoozedUntil : null,
  } satisfies ReminderRecord;
}

function getNoteAssetPaths(note: Pick<NoteRecord, "objects" | "drawingData">) {
  const rawObjects = note.objects ?? note.drawingData;
  if (!rawObjects) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(rawObjects) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return parsed
      .map((object) => {
        if (object?.type === "image" && typeof object.src === "string") {
          return object.src;
        }

        if (object?.type === "file" && typeof object.path === "string") {
          return object.path;
        }

        return null;
      })
      .filter((assetPath): assetPath is string => Boolean(assetPath && assetPath.startsWith(assetsDirPath)));
  } catch {
    return [] as string[];
  }
}

function syncNoteReminderState(noteId: string) {
  const reminders = listRemindersByNote(noteId).filter((reminder) => reminder.status === "active");
  const nextReminderAt = reminders
    .map((reminder) => computeReminderTriggerIso(reminder))
    .sort()[0] ?? null;

  getDb()
    .prepare(
      `
        UPDATE notes
        SET reminderAt = ?, remindedAt = CASE WHEN ? IS NULL THEN remindedAt ELSE NULL END
        WHERE id = ?
      `
    )
    .run(nextReminderAt, nextReminderAt, noteId);
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
    SELECT
      id,
      folderId,
      title,
      content,
      tags,
      isFavorite,
      objects,
      COALESCE(objects, drawingData) AS drawingData,
      attachmentsData,
      attachmentThumbnailsData,
      deleted,
      reminderAt,
      remindedAt,
      deletedAt,
      createdAt,
      updatedAt
    FROM notes
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
  const normalizedObjects = note.objects ?? note.drawingData ?? null;
  const normalizedDrawingData = note.drawingData ?? null;
  const normalizedAttachmentsData = note.attachmentsData ?? null;
  const normalizedAttachmentThumbnailsData = note.attachmentThumbnailsData ?? null;
  const normalizedDeletedAt = note.deletedAt ?? null;
  const nextRemindedAt =
    normalizedReminderAt && normalizedReminderAt === existingNote?.reminderAt
      ? note.remindedAt ?? existingNote?.remindedAt ?? null
      : null;

  getDb()
    .prepare(
      `
        UPDATE notes
        SET title = ?, content = ?, tags = ?, folderId = ?, isFavorite = ?, objects = ?, drawingData = ?, attachmentsData = ?, attachmentThumbnailsData = ?, deleted = ?, reminderAt = ?, remindedAt = ?, deletedAt = ?, updatedAt = ?
        WHERE id = ?
      `
    )
    .run(
      note.title,
      note.content,
      note.tags,
      note.folderId ?? null,
      note.isFavorite ? 1 : 0,
      normalizedObjects,
      normalizedDrawingData,
      normalizedAttachmentsData,
      normalizedAttachmentThumbnailsData,
      normalizedDeletedAt ? 1 : note.deleted ? 1 : 0,
      normalizedReminderAt,
      nextRemindedAt,
      normalizedDeletedAt,
      now,
      note.id
    );
}

export function deleteNote(id: string) {
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `
        UPDATE notes
        SET deleted = 1, deletedAt = ?, updatedAt = ?
        WHERE id = ?
      `
    )
    .run(now, now, id);
}

export function restoreNote(id: string) {
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `
        UPDATE notes
        SET deleted = 0, deletedAt = NULL, updatedAt = ?
        WHERE id = ?
      `
    )
    .run(now, id);
}

export function permanentlyDeleteNote(id: string) {
  const note = getNoteById(id);

  if (note) {
    for (const assetPath of getNoteAssetPaths(note)) {
      fs.rmSync(assetPath, { force: true });
    }
  }

  getDb().prepare("DELETE FROM reminders WHERE noteId = ?").run(id);
  getDb().prepare("DELETE FROM notes WHERE id = ?").run(id);
}

export function listRemindersByNote(noteId: string) {
  return getDb()
    .prepare(
      `
        SELECT
          id,
          noteId,
          reminderDate AS date,
          reminderTime AS time,
          repeatRule AS repeat,
          notificationOffset,
          COALESCE(message, '') AS message,
          status,
          createdAt,
          triggeredAt,
          snoozedUntil
        FROM reminders
        WHERE noteId = ?
        ORDER BY createdAt DESC
      `
    )
    .all(noteId)
    .map((record) => mapReminderRecord(record as Record<string, unknown>));
}

export function upsertReminder(reminder: ReminderRecord) {
  getDb()
    .prepare(
      `
        INSERT INTO reminders (
          id,
          noteId,
          reminderDate,
          reminderTime,
          repeatRule,
          notificationOffset,
          message,
          status,
          createdAt,
          triggeredAt,
          snoozedUntil
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          noteId = excluded.noteId,
          reminderDate = excluded.reminderDate,
          reminderTime = excluded.reminderTime,
          repeatRule = excluded.repeatRule,
          notificationOffset = excluded.notificationOffset,
          message = excluded.message,
          status = excluded.status,
          triggeredAt = excluded.triggeredAt,
          snoozedUntil = excluded.snoozedUntil
      `
    )
    .run(
      reminder.id,
      reminder.noteId,
      reminder.date,
      reminder.time,
      reminder.repeat,
      reminder.notificationOffset,
      reminder.message,
      reminder.status,
      reminder.createdAt,
      reminder.triggeredAt ?? null,
      reminder.snoozedUntil ?? null
    );

  syncNoteReminderState(reminder.noteId);
}

export function deleteReminder(id: string) {
  const reminder = getDb()
    .prepare(
      `
        SELECT noteId FROM reminders WHERE id = ?
      `
    )
    .get(id) as { noteId: string } | undefined;

  getDb().prepare("DELETE FROM reminders WHERE id = ?").run(id);

  if (reminder?.noteId) {
    syncNoteReminderState(reminder.noteId);
  }
}

export function snoozeReminder(id: string, snoozedUntilIso: string) {
  const reminder = getDb()
    .prepare(
      `
        SELECT noteId FROM reminders WHERE id = ?
      `
    )
    .get(id) as { noteId: string } | undefined;

  getDb()
    .prepare(
      `
        UPDATE reminders
        SET snoozedUntil = ?, triggeredAt = NULL, status = 'active'
        WHERE id = ?
      `
    )
    .run(snoozedUntilIso, id);

  if (reminder?.noteId) {
    syncNoteReminderState(reminder.noteId);
  }
}

export function getDueReminders(nowIso: string) {
  const rows = getDb()
    .prepare(
      `
        SELECT
          reminders.id,
          reminders.noteId,
          reminders.reminderDate AS date,
          reminders.reminderTime AS time,
          reminders.repeatRule AS repeat,
          reminders.notificationOffset,
          COALESCE(reminders.message, '') AS message,
          reminders.status,
          reminders.createdAt,
          reminders.triggeredAt,
          reminders.snoozedUntil,
          notes.folderId,
          notes.title,
          notes.content,
          notes.tags,
          notes.isFavorite,
          notes.objects,
          COALESCE(notes.objects, notes.drawingData) AS drawingData,
          notes.attachmentsData,
          notes.attachmentThumbnailsData,
          notes.deleted,
          notes.reminderAt,
          notes.remindedAt,
          notes.deletedAt,
          notes.createdAt AS noteCreatedAt,
          notes.updatedAt
        FROM reminders
        INNER JOIN notes ON notes.id = reminders.noteId
        WHERE reminders.status = 'active'
          AND notes.deletedAt IS NULL
      `
    )
    .all() as Array<Record<string, unknown>>;

  const nowTime = new Date(nowIso).getTime();

  return rows
    .map((row) => {
      const reminder = mapReminderRecord(row);
      const note = {
        id: String(row.noteId),
        folderId: (row.folderId as string | null | undefined) ?? null,
        title: String(row.title ?? "Untitled Note"),
        content: String(row.content ?? ""),
        tags: String(row.tags ?? ""),
        isFavorite: Boolean(row.isFavorite),
        objects: typeof row.objects === "string" ? row.objects : null,
        drawingData: typeof row.drawingData === "string" ? row.drawingData : null,
        attachmentsData: typeof row.attachmentsData === "string" ? row.attachmentsData : null,
        attachmentThumbnailsData:
          typeof row.attachmentThumbnailsData === "string" ? row.attachmentThumbnailsData : null,
        deleted: Boolean(row.deleted),
        reminderAt: typeof row.reminderAt === "string" ? row.reminderAt : null,
        remindedAt: typeof row.remindedAt === "string" ? row.remindedAt : null,
        deletedAt: typeof row.deletedAt === "string" ? row.deletedAt : null,
        createdAt: String(row.noteCreatedAt ?? new Date().toISOString()),
        updatedAt: String(row.updatedAt ?? new Date().toISOString()),
      } satisfies NoteRecord;

      return {
        reminder,
        note,
        triggerAt: computeReminderTriggerIso(reminder),
      };
    })
    .filter((entry) => new Date(entry.triggerAt).getTime() <= nowTime)
    .sort((left, right) => left.triggerAt.localeCompare(right.triggerAt))
    .map(({ reminder, note }) => ({ reminder, note }));
}

export function markReminderTriggered(id: string, triggeredAtIso: string) {
  const reminderRows = getDb()
    .prepare(
      `
        SELECT
          id,
          noteId,
          reminderDate AS date,
          reminderTime AS time,
          repeatRule AS repeat,
          notificationOffset,
          COALESCE(message, '') AS message,
          status,
          createdAt,
          triggeredAt,
          snoozedUntil
        FROM reminders
        WHERE id = ?
      `
    )
    .all(id) as Array<Record<string, unknown>>;

  const reminder = reminderRows[0] ? mapReminderRecord(reminderRows[0]) : null;

  if (!reminder) {
    return;
  }

  const nextOccurrence = computeNextOccurrence(reminder);

  if (!nextOccurrence) {
    getDb()
      .prepare(
        `
          UPDATE reminders
          SET status = 'triggered', triggeredAt = ?, snoozedUntil = NULL
          WHERE id = ?
        `
      )
      .run(triggeredAtIso, id);
  } else {
    getDb()
      .prepare(
        `
          UPDATE reminders
          SET reminderDate = ?, reminderTime = ?, triggeredAt = NULL, snoozedUntil = NULL, status = 'active'
          WHERE id = ?
        `
      )
      .run(nextOccurrence.date, nextOccurrence.time, id);
  }

  syncNoteReminderState(reminder.noteId);
}

export function importAsset(fileName: string, dataUrl: string) {
  const extension = path.extname(fileName) || "";
  const assetPath = path.join(assetsDirPath, `${uuidv4()}${extension}`);
  const encoded = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  fs.writeFileSync(assetPath, Buffer.from(encoded, "base64"));
  return assetPath;
}

export function deleteAsset(assetPath: string) {
  if (!assetPath.startsWith(assetsDirPath)) {
    return;
  }

  fs.rmSync(assetPath, { force: true });
}
