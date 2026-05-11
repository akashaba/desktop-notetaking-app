export type ReminderRepeatRule = "once" | "daily" | "weekly" | "monthly" | "yearly";
export type ReminderNotificationOffset =
  | "at_time"
  | "5_min_before"
  | "10_min_before"
  | "30_min_before"
  | "1_hour_before";
export type ReminderStatus = "active" | "triggered" | "cancelled";

export type Reminder = {
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

export function listRemindersByNote(noteId: string) {
  return window.notesApi.reminders.listByNote(noteId);
}

export function upsertReminder(reminder: Reminder) {
  return window.notesApi.reminders.upsert(reminder);
}

export function deleteReminder(reminderId: string) {
  return window.notesApi.reminders.delete(reminderId);
}

export function snoozeReminder(reminderId: string, snoozedUntilIso: string) {
  return window.notesApi.reminders.snooze(reminderId, snoozedUntilIso);
}
