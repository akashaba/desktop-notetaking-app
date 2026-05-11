import {
  FiBell,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiSearch,
  FiFileText,
  FiFolder,
  FiPlus,
  FiSettings,
  FiStar,
  FiTag,
  FiTrash2,
} from "react-icons/fi";
import type { Dispatch, SetStateAction } from "react";
import type { Folder } from "../folders/foldersService";
import type { Note } from "../notes/notesService";

type CollapsedPanelsState = {
  notebooks: boolean;
  notes: boolean;
};

type AppSidebarProps = {
  activeView: "all" | "favorites" | "recent" | "reminders" | "trash";
  selectedFolderId: string | null;
  collapsedPanels: CollapsedPanelsState;
  setCollapsedPanels: Dispatch<SetStateAction<CollapsedPanelsState>>;
  isCreatingFolder: boolean;
  setIsCreatingFolder: Dispatch<SetStateAction<boolean>>;
  newFolderName: string;
  setNewFolderName: Dispatch<SetStateAction<string>>;
  folderError: string | null;
  setFolderError: Dispatch<SetStateAction<string | null>>;
  folders: Folder[];
  visibleNotes: Note[];
  selectedNoteId: string | null;
  activeCollectionLabel: string;
  emptyStateCopy: string;
  search: string;
  onSearchChange: (value: string) => void;
  reminderCount: number;
  trashCount: number;
  getNotePreview: (note: Pick<Note, "content">) => string;
  onCreateFolder: () => Promise<void>;
  onSelectNote: (noteId: string) => Promise<void>;
  onSelectAllNotes: () => void;
  onSelectFavorites: () => void;
  onSelectRecent: () => void;
  onSelectReminders: () => void;
  onSelectTrash: () => void;
  onSelectFolder: (folderId: string) => void;
  onOpenTags: () => void;
};

export function AppSidebar({
  activeView,
  selectedFolderId,
  collapsedPanels,
  setCollapsedPanels,
  isCreatingFolder,
  setIsCreatingFolder,
  newFolderName,
  setNewFolderName,
  folderError,
  setFolderError,
  folders,
  visibleNotes,
  selectedNoteId,
  activeCollectionLabel,
  emptyStateCopy,
  search,
  onSearchChange,
  reminderCount,
  trashCount,
  getNotePreview,
  onCreateFolder,
  onSelectNote,
  onSelectAllNotes,
  onSelectFavorites,
  onSelectRecent,
  onSelectReminders,
  onSelectTrash,
  onSelectFolder,
  onOpenTags,
}: AppSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top-search">
        <FiSearch />
        <input
          className="sidebar-search-input"
          placeholder="Search notes..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <button className="top-icon-btn compact" type="button" onClick={onSelectAllNotes}>
          <FiPlus />
        </button>
      </div>

      <div className="sidebar-scroll">
        <nav className="sidebar-nav">
          <button className={activeView === "all" && !selectedFolderId ? "nav-item active" : "nav-item"} onClick={onSelectAllNotes}>
            <FiFileText />
            <span>All Notes</span>
          </button>

          <button className={activeView === "favorites" ? "nav-item active" : "nav-item"} onClick={onSelectFavorites}>
            <FiStar />
            <span>Favorites</span>
          </button>

          <button className={activeView === "recent" ? "nav-item active" : "nav-item"} onClick={onSelectRecent}>
            <FiClock />
            <span>Recent</span>
          </button>
        </nav>

        <div className="sidebar-section">
          <div className="section-head interactive">
            <button
              className="section-toggle"
              onClick={() =>
                setCollapsedPanels((current) => ({
                  ...current,
                  notebooks: !current.notebooks,
                }))
              }
            >
              {collapsedPanels.notebooks ? <FiChevronRight /> : <FiChevronDown />}
              <span>Notebooks</span>
            </button>
            <button className="icon-chip" onClick={() => setIsCreatingFolder((current) => !current)}>
              <FiPlus />
            </button>
          </div>

          {isCreatingFolder ? (
            <div className="folder-creator compact">
              <input
                value={newFolderName}
                placeholder="New notebook"
                onChange={(event) => {
                  setNewFolderName(event.target.value);
                  if (folderError) {
                    setFolderError(null);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void onCreateFolder();
                  }
                }}
              />
              <div className="folder-creator-actions">
                <button className="tool-btn active" onClick={() => void onCreateFolder()}>
                  Create
                </button>
                <button
                  className="tool-btn"
                  onClick={() => {
                    setIsCreatingFolder(false);
                    setNewFolderName("");
                    setFolderError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
              {folderError ? <p className="form-error">{folderError}</p> : null}
            </div>
          ) : null}

          <div className={collapsedPanels.notebooks ? "folder-links collapsed" : "folder-links"}>
            {folders.map((folder) => (
              <button
                key={folder.id}
                className={activeView === "all" && selectedFolderId === folder.id ? "nav-item active" : "nav-item"}
                onClick={() => onSelectFolder(folder.id)}
              >
                <FiFolder />
                <span>{folder.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-section secondary-links">
          <button className="nav-item" onClick={onOpenTags}>
            <FiTag />
            <span>Tags</span>
          </button>

          <button className={activeView === "reminders" ? "nav-item active" : "nav-item"} onClick={onSelectReminders}>
            <FiBell />
            <span>Reminders</span>
            {reminderCount > 0 ? <span className="badge">{reminderCount}</span> : null}
          </button>

          <button className={activeView === "trash" ? "nav-item active" : "nav-item"} onClick={onSelectTrash}>
            <FiTrash2 />
            <span>Trash</span>
            {trashCount > 0 ? <span className="badge badge-danger">{trashCount}</span> : null}
          </button>
        </div>

        <div className="notes-rail">
          <div className="section-head interactive">
            <button
              className="section-toggle"
              onClick={() =>
                setCollapsedPanels((current) => ({
                  ...current,
                  notes: !current.notes,
                }))
              }
            >
              {collapsedPanels.notes ? <FiChevronRight /> : <FiChevronDown />}
              <span>{activeCollectionLabel}</span>
            </button>
            <span className="count-pill">{visibleNotes.length}</span>
          </div>

          <div className={collapsedPanels.notes ? "note-list collapsed" : "note-list"}>
            {visibleNotes.length > 0 ? (
              visibleNotes.map((note) => (
                <button
                  key={note.id}
                  className={selectedNoteId === note.id ? "note-list-item active" : "note-list-item"}
                  onClick={() => void onSelectNote(note.id)}
                >
                  <div className="note-list-title-row">
                    <span>{note.title || "Untitled"}</span>
                    {note.isFavorite ? <FiStar className="star-icon" /> : null}
                  </div>
                  <small>
                    {note.deletedAt
                      ? `Deleted ${new Date(note.deletedAt).toLocaleDateString()}`
                      : new Date(note.updatedAt).toLocaleDateString()}
                  </small>
                  <p className="note-list-preview">{getNotePreview(note)}</p>
                </button>
              ))
            ) : (
              <div className="notes-empty-state compact">
                <h3>No notes here</h3>
                <p>{emptyStateCopy}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sidebar-footer-stack">
        <div className="profile-card">
          <div className="profile-avatar">JD</div>
          <div className="profile-copy">
            <strong>John Doe</strong>
            <span>john@example.com</span>
          </div>
          <FiSettings className="profile-settings" />
        </div>

        <div className="storage-card">
          <div className="storage-card-copy">
            <strong>Local storage</strong>
            <span>1.2 GB of 5 GB used</span>
          </div>
          <div className="storage-meter">
            <span style={{ width: "24%" }} />
          </div>
        </div>
      </div>
    </aside>
  );
}