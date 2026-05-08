import { useEffect, useMemo, useState } from "react";
import {
  createNote,
  deleteNote,
  getNoteById,
  getNotes,
  updateNote,
} from "./features/notes/notesService";
import type { Note } from "./features/notes/notesService";
import { createFolder, getFolders } from "./features/folders/foldersService";
import type { Folder } from "./features/folders/foldersService";
import { useDebounce } from "./utils/useDebounce";
import "./App.css";

type NotesView = "all" | "favorites" | "reminders";

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NotesView>("all");
  const [search, setSearch] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const debouncedNote = useDebounce(selectedNote, 800);

  const selectedFolderName = useMemo(() => {
    if (activeView === "favorites") {
      return "Favorites";
    }

    if (activeView === "reminders") {
      return "Reminders";
    }

    if (!selectedFolderId) {
      return "All Notes";
    }

    return folders.find((folder) => folder.id === selectedFolderId)?.name ?? "Folder";
  }, [activeView, folders, selectedFolderId]);

  const visibleNotes = useMemo(() => {
    if (activeView === "favorites") {
      return notes.filter((note) => Boolean(note.isFavorite));
    }

    if (activeView !== "reminders") {
      return notes;
    }

    const now = Date.now();

    return notes.filter((note) => {
      if (!note.reminderAt) {
        return false;
      }

      return new Date(note.reminderAt).getTime() >= now;
    });
  }, [activeView, notes]);

  const loadFolders = async () => {
    setFolders(await getFolders());
  };

  const loadNotes = async () => {
    const folderFilter = activeView === "all" ? selectedFolderId : null;
    setNotes(await getNotes(search, folderFilter));
  };

  useEffect(() => {
    void (async () => {
      await loadFolders();

      const lastFolderId = localStorage.getItem("lastSelectedFolderId");
      const lastNoteId = localStorage.getItem("lastSelectedNoteId");

      if (lastFolderId) {
        setSelectedFolderId(lastFolderId);
      }

      if (lastNoteId) {
        const note = await getNoteById(lastNoteId);
        if (note) {
          setSelectedNote(note);
        }
      }
    })();
  }, []);

  useEffect(() => {
    void loadNotes();
  }, [activeView, search, selectedFolderId]);

  useEffect(() => {
    if (!debouncedNote) return;

    let isCancelled = false;

    void (async () => {
      setSaveStatus("saving");
      await updateNote(debouncedNote);
      await loadNotes();
      localStorage.setItem("lastSelectedNoteId", debouncedNote.id);

      window.setTimeout(() => {
        if (!isCancelled) {
          setSaveStatus("saved");
        }
      }, 300);
    })();

    return () => {
      isCancelled = true;
    };
  }, [debouncedNote]);

  const handleCreateNote = async () => {
    const id = await createNote(selectedFolderId);
    const note = await getNoteById(id);
    setSelectedNote(note);
    await loadNotes();
  };

  const handleToggleFavorite = async () => {
    if (!selectedNote) {
      return;
    }

    const nextFavoriteValue = selectedNote.isFavorite ? 0 : 1;
    const persistedNote = await getNoteById(selectedNote.id);

    if (!persistedNote) {
      return;
    }

    await updateNote({
      ...persistedNote,
      isFavorite: nextFavoriteValue,
    });

    setSelectedNote({
      ...selectedNote,
      isFavorite: nextFavoriteValue,
    });

    await loadNotes();
  };

  const handleCreateFolder = async () => {
    const trimmedName = newFolderName.trim();

    if (!trimmedName) {
      setFolderError("Folder name is required.");
      return;
    }

    try {
      await createFolder(trimmedName);
      setNewFolderName("");
      setFolderError(null);
      setIsCreatingFolder(false);
      await loadFolders();
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Could not create folder.");
    }
  };

  const reminderInputValue = selectedNote?.reminderAt
    ? new Date(selectedNote.reminderAt).toISOString().slice(0, 16)
    : "";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">N</div>
          <div>
            <h2>Notebook</h2>
            <span>Offline AI Notes</span>
          </div>
        </div>

        <button className="primary-btn" onClick={() => void handleCreateNote()}>
          + New Note
        </button>

        <button
          className="secondary-btn"
          onClick={() => {
            setIsCreatingFolder((current) => !current);
            setFolderError(null);
          }}
        >
          + New Folder
        </button>

        {isCreatingFolder && (
          <div className="folder-creator">
            <input
              value={newFolderName}
              placeholder="Folder name"
              onChange={(event) => {
                setNewFolderName(event.target.value);
                if (folderError) {
                  setFolderError(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleCreateFolder();
                }
              }}
            />
            <div className="folder-creator-actions">
              <button className="primary-btn small" onClick={() => void handleCreateFolder()}>
                Add
              </button>
              <button
                className="secondary-btn small"
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName("");
                  setFolderError(null);
                }}
              >
                Cancel
              </button>
            </div>
            {folderError && <p className="form-error">{folderError}</p>}
          </div>
        )}

        <nav className="nav-section">
          <p className="section-label">Workspace</p>

          <div
            className={activeView === "all" && !selectedFolderId ? "nav-item active" : "nav-item"}
            onClick={() => {
              setActiveView("all");
              setSelectedFolderId(null);
              localStorage.removeItem("lastSelectedFolderId");
            }}
          >
            <span>📝</span>
            <span>All Notes</span>
          </div>

          <div
            className={activeView === "favorites" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setActiveView("favorites");
              setSelectedFolderId(null);
            }}
          >
            <span>⭐</span>
            <span>Favorites</span>
          </div>

          <div className={activeView === "reminders" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setActiveView("reminders");
              setSelectedFolderId(null);
            }}
          >
            <span>⏰</span>
            <span>Reminders</span>
          </div>
        </nav>

        <nav className="nav-section">
          <p className="section-label">Folders</p>

          {folders.map((folder) => (
            <div
              key={folder.id}
              className={
                activeView === "all" && selectedFolderId === folder.id
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => {
                setActiveView("all");
                setSelectedFolderId(folder.id);
                localStorage.setItem("lastSelectedFolderId", folder.id);
              }}
            >
              <span>📁</span>
              <span>{folder.name}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sync-pill">● All changes local</div>
        </div>
      </aside>

      <section className="notes-panel">
        <div className="panel-header">
          <div>
            <h1>{selectedFolderName}</h1>
            <span>{visibleNotes.length} notes</span>
          </div>
        </div>

        <div className="search-box">
          <span>⌕</span>
          <input
            placeholder="Search notes, tags, content..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="notes-scroll">
          {visibleNotes.length > 0 ? (
            visibleNotes.map((note) => (
            <article
              key={note.id}
              className={selectedNote?.id === note.id ? "note-card active" : "note-card"}
              onClick={async () => setSelectedNote(await getNoteById(note.id))}
            >
              <div className="note-card-top">
                <h3>{note.title || "Untitled Note"}</h3>
                <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
              </div>

              <p>{note.content || "No content yet..."}</p>

              {note.tags && (
                <div className="tag-row">
                  {note.tags.split(",").map((tag) => (
                    <span key={`${note.id}-${tag.trim()}`} className="tag">
                      #{tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              {note.isFavorite ? <div className="favorite-badge">Favorite</div> : null}

              {note.reminderAt && (
                <div className="note-meta">Reminder: {new Date(note.reminderAt).toLocaleString()}</div>
              )}
            </article>
            ))
          ) : (
            <div className="notes-empty-state">
              <h3>{activeView === "reminders" ? "No upcoming reminders" : "No notes found"}</h3>
              <p>
                {activeView === "reminders"
                  ? "Set a reminder on any note and it will appear here until it fires."
                  : activeView === "favorites"
                    ? "Mark any note as a favorite and it will appear here."
                  : "Create a note or broaden your search to see results here."}
              </p>
            </div>
          )}
        </div>
      </section>

      <main className="editor-panel">
        {selectedNote ? (
          <>
            <header className="editor-header">
              <div>
                <span className="breadcrumb">{selectedFolderName}</span>
                <input
                  className="title-input"
                  value={selectedNote.title}
                  onChange={(event) =>
                    setSelectedNote({ ...selectedNote, title: event.target.value })
                  }
                />
              </div>

              <div className="editor-actions">
                <span className="save-status">
                  {saveStatus === "saving" && "Saving..."}
                  {saveStatus === "saved" && "Saved"}
                  {saveStatus === "idle" && "Ready"}
                </span>
                <button
                  className={selectedNote.isFavorite ? "favorite-btn active" : "favorite-btn"}
                  type="button"
                  onClick={() => void handleToggleFavorite()}
                >
                  {selectedNote.isFavorite ? "Unfavorite" : "Favorite"}
                </button>
                <button className="ai-btn" type="button">
                  AI Assist
                </button>
                <button
                  className="danger-btn"
                  onClick={async () => {
                    await deleteNote(selectedNote.id);
                    setSelectedNote(null);
                    localStorage.removeItem("lastSelectedNoteId");
                    await loadNotes();
                  }}
                >
                  Delete
                </button>
              </div>
            </header>

            <div className="meta-row">
              <select
                value={selectedNote.folderId ?? ""}
                onChange={(event) =>
                  setSelectedNote({
                    ...selectedNote,
                    folderId: event.target.value || null,
                  })
                }
              >
                <option value="">No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>

              <input
                placeholder="Tags: work, ideas, research"
                value={selectedNote.tags}
                onChange={(event) =>
                  setSelectedNote({ ...selectedNote, tags: event.target.value })
                }
              />

              <input
                type="datetime-local"
                value={reminderInputValue}
                onChange={(event) => {
                  const nextReminderAt = event.target.value
                    ? new Date(event.target.value).toISOString()
                    : null;

                  setSelectedNote({
                    ...selectedNote,
                    reminderAt: nextReminderAt,
                    remindedAt: null,
                  });
                }}
              />

              <span>Updated {new Date(selectedNote.updatedAt).toLocaleString()}</span>
            </div>

            <section className="paper-wrapper">
              <textarea
                className="paper-editor"
                placeholder="Start writing your thoughts..."
                value={selectedNote.content}
                onChange={(event) =>
                  setSelectedNote({ ...selectedNote, content: event.target.value })
                }
              />
            </section>

            <footer className="editor-status">
              <span>Offline ready</span>
              <span>{selectedNote.content.length} characters</span>
            </footer>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">✍️</div>
            <h1>Select or create a note</h1>
            <p>Write, organize, search, and sync your notes later.</p>
            <button className="primary-btn wide" onClick={() => void handleCreateNote()}>
              Create your first note
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;