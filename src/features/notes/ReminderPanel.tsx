import { FiBell, FiClock, FiCalendar } from "react-icons/fi";
import type { Reminder, ReminderNotificationOffset, ReminderRepeatRule } from "./remindersService";

type ReminderPanelProps = {
  isOpen: boolean;
  reminder: Reminder;
  isDisabled: boolean;
  onChange: (updates: Partial<Reminder>) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

const REPEAT_OPTIONS: Array<{ value: ReminderRepeatRule; label: string }> = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const OFFSET_OPTIONS: Array<{ value: ReminderNotificationOffset; label: string }> = [
  { value: "at_time", label: "At time of reminder" },
  { value: "5_min_before", label: "5 minutes before" },
  { value: "10_min_before", label: "10 minutes before" },
  { value: "30_min_before", label: "30 minutes before" },
  { value: "1_hour_before", label: "1 hour before" },
];

export function ReminderPanel({
  isOpen,
  reminder,
  isDisabled,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: ReminderPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <aside className="floating-panel reminder-panel">
      <div className="floating-panel-header">
        <div className="floating-panel-title">
          <FiBell />
          <strong>Reminder</strong>
        </div>
      </div>

      <div className="floating-panel-body">
        <label className="floating-field-group two-up">
          <span>
            <FiCalendar />
            Date
          </span>
          <input
            type="date"
            value={reminder.date}
            disabled={isDisabled}
            onChange={(event) => onChange({ date: event.target.value })}
          />
        </label>

        <label className="floating-field-group two-up">
          <span>
            <FiClock />
            Time
          </span>
          <input
            type="time"
            value={reminder.time}
            disabled={isDisabled}
            onChange={(event) => onChange({ time: event.target.value })}
          />
        </label>

        <label className="floating-field-group">
          <span>Repeat</span>
          <select
            value={reminder.repeat}
            disabled={isDisabled}
            onChange={(event) => onChange({ repeat: event.target.value as ReminderRepeatRule })}
          >
            {REPEAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="floating-field-group">
          <span>Notification</span>
          <select
            value={reminder.notificationOffset}
            disabled={isDisabled}
            onChange={(event) =>
              onChange({ notificationOffset: event.target.value as ReminderNotificationOffset })
            }
          >
            {OFFSET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="floating-field-group">
          <span>Note</span>
          <input
            type="text"
            placeholder="Review project roadmap and update tasks"
            value={reminder.message}
            disabled={isDisabled}
            onChange={(event) => onChange({ message: event.target.value })}
          />
        </label>
      </div>

      <div className="floating-panel-actions">
        {onDelete ? (
          <button className="tool-btn danger ghost-danger" type="button" onClick={onDelete}>
            Remove
          </button>
        ) : null}
        <button className="tool-btn" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="tool-btn active" type="button" onClick={onSave}>
          Save Reminder
        </button>
      </div>
    </aside>
  );
}
