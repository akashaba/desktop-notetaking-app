import { FiFileText, FiTrash2, FiX } from "react-icons/fi";
import type { Note } from "./notesService";

type TrashPanelProps = {
  notes: Note[];
  onSelectNote: (noteId: string) => void;
  onClose: () => void;
  onViewTrash: () => void;
  onRestoreNote: (noteId: string) => void;
  onPurgeNote: (noteId: string) => void;
  onRestoreAll: () => void;
  onPurgeAll: () => void;
};

export function TrashPanel({
  notes,
  onSelectNote,
  onClose,
  onViewTrash,
  onRestoreNote,
  onPurgeNote,
  onRestoreAll,
  onPurgeAll,
}: TrashPanelProps) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <aside className="floating-panel trash-panel">
      <div className="floating-panel-header">
        <div className="floating-panel-title">
          <FiTrash2 />
          <div>
            <strong>Trash</strong>
            <span>{notes.length} item{notes.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <button className="panel-close-btn" type="button" onClick={onClose}>
          <FiX />
        </button>
      </div>

      <div className="trash-list">
        {notes.slice(0, 4).map((note) => (
          <article key={note.id} className="trash-item">
            <button className="trash-item-main" type="button" onClick={() => onSelectNote(note.id)}>
              <FiFileText />
              <div>
                <strong>{note.title || "Untitled"}</strong>
                <span>
                  {note.deletedAt
                    ? `Deleted ${new Date(note.deletedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}`
                    : "Deleted recently"}
                </span>
              </div>
            </button>
            <div className="trash-item-actions">
              <button className="text-link-btn" type="button" onClick={() => onRestoreNote(note.id)}>
                Restore
              </button>
              <button className="text-link-btn danger-link" type="button" onClick={() => onPurgeNote(note.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="trash-panel-actions">
        <button className="tool-btn" type="button" onClick={onViewTrash}>
          View all in trash
        </button>
        <button className="tool-btn" type="button" onClick={onRestoreAll}>
          Restore all
        </button>
        <button className="tool-btn danger ghost-danger" type="button" onClick={onPurgeAll}>
          Empty trash
        </button>
      </div>
    </aside>
  );
}
