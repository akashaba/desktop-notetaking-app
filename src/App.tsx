import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  FiBell,
  FiBookOpen,
  FiChevronDown,
  FiChevronRight,
  FiCalendar,
  FiClock,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiFolder,
  FiImage,
  FiMoreVertical,
  FiPaperclip,
  FiPlus,
  FiArrowUpRight,
  FiRotateCcw,
  FiSquare,
  FiStar,
  FiTrash2,
  FiType,
  FiMousePointer,
  FiUpload,
} from "react-icons/fi";
import {
  MdChecklist,
  MdFormatBold,
  MdFormatItalic,
  MdFormatListNumbered,
  MdFormatListBulleted,
  MdFormatUnderlined,
} from "react-icons/md";
import { LuBrainCircuit, LuPenTool } from "react-icons/lu";
import {
  createNote,
  deleteNote,
  getNoteById,
  getNotes,
  purgeNote,
  restoreNote,
  updateNote,
} from "./features/notes/notesService";
import type { Note } from "./features/notes/notesService";
import { createFolder, getFolders } from "./features/folders/foldersService";
import type { Folder } from "./features/folders/foldersService";
import { AppSidebar } from "./features/app/AppSidebar";
import { DrawingToolbar } from "./features/notes/DrawingToolbar";
import { ReminderPanel } from "./features/notes/ReminderPanel";
import { RichTextEditor, type RichTextEditorHandle } from "./features/notes/RichTextEditor";
import { DrawingLayer, type DrawTool, type ShapeTool } from "./features/notes/DrawingLayer";
import { ObjectLayer } from "./features/notes/ObjectLayer";
import { listRemindersByNote, snoozeReminder, upsertReminder, deleteReminder, type Reminder } from "./features/notes/remindersService";
import { SelectedObjectToolbar } from "./features/notes/SelectedObjectToolbar";
import { TrashPanel } from "./features/notes/TrashPanel";
import {
  extractPlainTextFromContent,
  parseObjectsData,
  stringifyObjectsData,
  type NoteObject,
} from "./features/notes/noteModel";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Could not read file."));
    };

    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

type NotesView = "all" | "favorites" | "recent" | "reminders" | "trash";
type CollapsedPanelsState = {
  notebooks: boolean;
  notes: boolean;
};

const DEFAULT_COLLAPSED_PANELS: CollapsedPanelsState = {
  notebooks: false,
  notes: true,
};

const SHAPE_OPTIONS: Array<{ tool: ShapeTool; label: string }> = [
  { tool: "rect", label: "Rectangle" },
  { tool: "roundedRect", label: "Rounded Rectangle" },
  { tool: "circle", label: "Circle" },
  { tool: "oval", label: "Oval" },
  { tool: "triangle", label: "Triangle" },
  { tool: "diamond", label: "Diamond" },
  { tool: "line", label: "Line" },
  { tool: "dashedLine", label: "Dashed Line" },
  { tool: "doubleArrow", label: "Double Arrow" },
  { tool: "cloud", label: "Cloud" },
  { tool: "callout", label: "Callout / Speech Bubble" },
  { tool: "bracket", label: "Bracket" },
  { tool: "cylinder", label: "Cylinder / Database" },
  { tool: "stickyNote", label: "Sticky Note" },
  { tool: "star", label: "Star" },
];

function getCollapsedPanelsStorageKey(noteId: string) {
  return `noteSidebarPanels:${noteId}`;
}

function parseCollapsedPanelsState(value: string | null): CollapsedPanelsState | null {
  if (!value) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(value) as Partial<CollapsedPanelsState>;

    if (
      typeof parsedValue.notebooks === "boolean" &&
      typeof parsedValue.notes === "boolean"
    ) {
      return {
        notebooks: parsedValue.notebooks,
        notes: parsedValue.notes,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getNotePreview(note: Pick<Note, "content">) {
  const previewText = extractPlainTextFromContent(note.content);

  if (!previewText) {
    return "No content yet.";
  }

  return previewText.length > 96 ? `${previewText.slice(0, 96)}...` : previewText;
}

function getRelativeLastEditedLabel(updatedAt: string) {
  const deltaMs = Date.now() - new Date(updatedAt).getTime();
  const deltaMinutes = Math.max(0, Math.round(deltaMs / 60000));

  if (deltaMinutes <= 1) {
    return "Last edited just now";
  }

  if (deltaMinutes < 60) {
    return `Last edited ${deltaMinutes} min ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `Last edited ${deltaHours} hr ago`;
  }

  return `Last edited ${new Date(updatedAt).toLocaleDateString()}`;
}

function createDefaultReminder(noteId: string): Reminder {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  return {
    id: crypto.randomUUID(),
    noteId,
    date: nextHour.toISOString().slice(0, 10),
    time: nextHour.toTimeString().slice(0, 5),
    repeat: "once",
    notificationOffset: "at_time",
    message: "",
    status: "active",
    createdAt: new Date().toISOString(),
    triggeredAt: null,
    snoozedUntil: null,
  };
}

function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delay, value]);

  return debouncedValue;
}

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
  const [collapsedPanels, setCollapsedPanels] = useState<CollapsedPanelsState>(
    DEFAULT_COLLAPSED_PANELS
  );
  const [collapsedPanelsOwnerId, setCollapsedPanelsOwnerId] = useState<string | null>(null);
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);
  const [editorMode, setEditorMode] = useState<"text" | "draw">("text");
  const [activeTool, setActiveTool] = useState<DrawTool>("freehand");
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [drawColor, setDrawColor] = useState("#1e293b");
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [isReminderPanelOpen, setIsReminderPanelOpen] = useState(false);
  const [isTrashPanelOpen, setIsTrashPanelOpen] = useState(true);
  const [noteReminders, setNoteReminders] = useState<Reminder[]>([]);
  const [reminderDraft, setReminderDraft] = useState<Reminder | null>(null);
  const [dueReminderNotice, setDueReminderNotice] = useState<{
    reminder: Reminder;
    noteId: string;
    noteTitle: string;
  } | null>(null);

  const debouncedNote = useDebounce(selectedNote, 800);
  const richEditorRef = useRef<RichTextEditorHandle | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shapeMenuRef = useRef<HTMLDivElement | null>(null);
  const dragDepthRef = useRef(0);
  const paperSurfaceRef = useRef<HTMLDivElement | null>(null);
  const paperScrollRef = useRef<HTMLDivElement | null>(null);
  const drawingHistoryRef = useRef<{ noteId: string | null; undo: string[]; redo: string[] }>({
    noteId: null,
    undo: [],
    redo: [],
  });

  const visibleNotes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    let nextNotes = [...notes].filter((note) =>
      activeView === "trash" ? Boolean(note.deletedAt) : !note.deletedAt
    );

    if (activeView === "favorites") {
      nextNotes = nextNotes.filter((note) => Boolean(note.isFavorite));
    } else if (activeView === "reminders") {
      const now = Date.now();
      nextNotes = nextNotes.filter((note) => {
        if (!note.reminderAt) {
          return false;
        }

        return new Date(note.reminderAt).getTime() >= now;
      });
    } else if (activeView === "all" && selectedFolderId) {
      nextNotes = nextNotes.filter((note) => note.folderId === selectedFolderId);
    } else if (activeView === "recent") {
      nextNotes = nextNotes.slice(0, 12);
    }

    if (normalizedSearch) {
      nextNotes = nextNotes.filter((note) =>
        `${note.title} ${extractPlainTextFromContent(note.content)} ${note.tags}`
          .toLowerCase()
          .includes(normalizedSearch)
      );
    }

    return nextNotes;
  }, [activeView, notes, search, selectedFolderId]);

  const reminderCount = useMemo(
    () =>
      notes.filter(
        (note) =>
          !note.deletedAt &&
          note.reminderAt &&
          new Date(note.reminderAt).getTime() >= Date.now()
      ).length,
    [notes]
  );

  const activeCollectionLabel = useMemo(() => {
    if (activeView === "favorites") {
      return "Favorites";
    }

    if (activeView === "recent") {
      return "Recent";
    }

    if (activeView === "reminders") {
      return "Reminders";
    }

    if (activeView === "trash") {
      return "Trash";
    }

    return folders.find((folder) => folder.id === selectedFolderId)?.name ?? "Notebook";
  }, [activeView, folders, selectedFolderId]);

  const selectedNoteDateLabel = useMemo(() => {
    if (!selectedNote) {
      return "";
    }

    return new Date(selectedNote.updatedAt).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [selectedNote]);

  const noteObjects = useMemo(
    () => parseObjectsData(selectedNote?.drawingData),
    [selectedNote?.drawingData]
  );

  const trashNotes = useMemo(
    () => notes.filter((note) => Boolean(note.deletedAt)).sort((left, right) => {
      const leftTime = left.deletedAt ? new Date(left.deletedAt).getTime() : 0;
      const rightTime = right.deletedAt ? new Date(right.deletedAt).getTime() : 0;
      return rightTime - leftTime;
    }),
    [notes]
  );

  const activeReminder = noteReminders.find((reminder) => reminder.status === "active") ?? null;

  const selectedObject = useMemo(
    () => noteObjects.find((object) => object.id === selectedObjectId) ?? null,
    [noteObjects, selectedObjectId]
  );

  const activeShapeLabel = useMemo(
    () => SHAPE_OPTIONS.find((shape) => shape.tool === activeTool)?.label ?? "Shapes",
    [activeTool]
  );

  const commitObjectsChange = useCallback(
    (objects: NoteObject[], options?: { recordHistory?: boolean }) => {
      if (!selectedNote || selectedNote.deletedAt) {
        return;
      }

      const currentSnapshot = stringifyObjectsData(noteObjects);
      const nextSnapshot = stringifyObjectsData(objects);

      if (currentSnapshot === nextSnapshot) {
        return;
      }

      if (options?.recordHistory !== false) {
        drawingHistoryRef.current.undo.push(currentSnapshot);
        if (drawingHistoryRef.current.undo.length > 100) {
          drawingHistoryRef.current.undo.shift();
        }
        drawingHistoryRef.current.redo = [];
      }

      setSelectedNote((current) =>
        current && !current.deletedAt ? { ...current, drawingData: nextSnapshot } : current
      );
      setSaveStatus("saving");
    },
    [noteObjects, selectedNote]
  );

  const handleObjectsChange = useCallback(
    (objects: NoteObject[]) => {
      commitObjectsChange(objects);
    },
    [commitObjectsChange]
  );

  const moveObjectBy = useCallback((object: NoteObject, dx: number, dy: number): NoteObject => {
    if (object.type === "path") {
      return {
        ...object,
        x: object.x + dx,
        y: object.y + dy,
        points: object.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      };
    }

    return {
      ...object,
      x: object.x + dx,
      y: object.y + dy,
    };
  }, []);

  const cloneObject = useCallback(
    (object: NoteObject): NoteObject => {
      const base = { ...moveObjectBy(object, 24, 24), id: crypto.randomUUID() };

      if (object.type === "path") {
        return {
          ...base,
          points: object.points.map((point) => ({ x: point.x + 24, y: point.y + 24 })),
        } as NoteObject;
      }

      return base;
    },
    [moveObjectBy]
  );

  const updateSelectedObject = useCallback(
    (updater: (object: NoteObject) => NoteObject) => {
      if (!selectedObjectId) {
        return;
      }

      handleObjectsChange(
        noteObjects.map((object) =>
          object.id === selectedObjectId ? updater(object) : object
        )
      );
    },
    [handleObjectsChange, noteObjects, selectedObjectId]
  );

  const deleteSelectedObject = useCallback(() => {
    if (!selectedObjectId) {
      return;
    }

    handleObjectsChange(noteObjects.filter((object) => object.id !== selectedObjectId));
    setSelectedObjectId(null);
  }, [handleObjectsChange, noteObjects, selectedObjectId]);

  const duplicateSelectedObject = useCallback(() => {
    if (!selectedObject) {
      return;
    }

    const duplicate = cloneObject(selectedObject);
    handleObjectsChange([...noteObjects, duplicate]);
    setSelectedObjectId(duplicate.id);
  }, [cloneObject, handleObjectsChange, noteObjects, selectedObject]);

  const moveSelectedObject = useCallback(
    (dx: number, dy: number) => {
      if (!selectedObjectId) {
        return;
      }

      updateSelectedObject((object) => moveObjectBy(object, dx, dy));
    },
    [moveObjectBy, selectedObjectId, updateSelectedObject]
  );

  const moveSelectedLayer = useCallback(
    (direction: -1 | 1) => {
      if (!selectedObjectId) {
        return;
      }

      const index = noteObjects.findIndex((object) => object.id === selectedObjectId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= noteObjects.length) {
        return;
      }

      const nextObjects = [...noteObjects];
      const [moved] = nextObjects.splice(index, 1);
      nextObjects.splice(targetIndex, 0, moved);
      handleObjectsChange(nextObjects);
    },
    [handleObjectsChange, noteObjects, selectedObjectId]
  );

  const handleUndoObjects = useCallback(() => {
    const previousSnapshot = drawingHistoryRef.current.undo.pop();
    if (!previousSnapshot) {
      return;
    }

    drawingHistoryRef.current.redo.push(stringifyObjectsData(noteObjects));
    commitObjectsChange(parseObjectsData(previousSnapshot), { recordHistory: false });
    setSelectedObjectId(null);
  }, [commitObjectsChange, noteObjects]);

  const handleRedoObjects = useCallback(() => {
    const nextSnapshot = drawingHistoryRef.current.redo.pop();
    if (!nextSnapshot) {
      return;
    }

    drawingHistoryRef.current.undo.push(stringifyObjectsData(noteObjects));
    commitObjectsChange(parseObjectsData(nextSnapshot), { recordHistory: false });
    setSelectedObjectId(null);
  }, [commitObjectsChange, noteObjects]);

  const handleClearDrawings = () => {
    handleObjectsChange([]);
    setSelectedObjectId(null);
  };

  const handleLabelCreate = (x: number, y: number) => {
    const newLabel: NoteObject = {
      id: crypto.randomUUID(),
      type: "label",
      x,
      y,
      width: 180,
      height: 64,
      rotation: 0,
      stroke: "transparent",
      fill: "transparent",
      strokeWidth: 1,
      text: "",
      fontSize: 22,
      fontFamily: "Caveat, cursive",
      textColor: drawColor,
    };
    handleObjectsChange([...noteObjects, newLabel]);
    setSelectedObjectId(newLabel.id);
  };

  const handleDrawColorChange = useCallback(
    (color: string) => {
      setDrawColor(color);
      if (!selectedObject) {
        return;
      }

      updateSelectedObject((object) => {
        if (object.type === "label") {
          return { ...object, textColor: color };
        }

        if (object.type === "image" || object.type === "file") {
          return object;
        }

        return { ...object, stroke: color };
      });
    },
    [selectedObject, updateSelectedObject]
  );

  const loadFolders = async () => {
    setFolders(await getFolders());
  };

  const loadNotes = async () => {
    setNotes(await getNotes());
  };

  const loadRemindersForNote = useCallback(async (noteId: string | null) => {
    if (!noteId) {
      setNoteReminders([]);
      setReminderDraft(null);
      return;
    }

    const reminders = await listRemindersByNote(noteId);
    setNoteReminders(reminders);
    setReminderDraft(reminders.find((reminder) => reminder.status === "active") ?? createDefaultReminder(noteId));
  }, []);

  const handleInlineAssetInsert = useCallback(async (file: File) => {
    if (!selectedNote || selectedNote.deletedAt) {
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    const assetPath = await window.notesApi.assets.import(file.name, dataUrl);
    const scrollTop = paperScrollRef.current?.scrollTop ?? 80;

    if (file.type.startsWith("image/")) {
      const image = new Image();
      image.src = dataUrl;
      await new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
      });

      const maxWidth = 400;
      const scale = image.naturalWidth > maxWidth ? maxWidth / image.naturalWidth : 1;
      const width = Math.round((image.naturalWidth || 320) * scale);
      const height = Math.round((image.naturalHeight || 220) * scale);
      const imageObject: NoteObject = {
        id: crypto.randomUUID(),
        type: "image",
        x: 380,
        y: scrollTop + 120,
        width,
        height,
        rotation: 0,
        stroke: "transparent",
        fill: "transparent",
        strokeWidth: 1,
        src: assetPath,
        fileName: file.name,
        mimeType: file.type || "image/png",
      };

      handleObjectsChange([...noteObjects, imageObject]);
      setSelectedObjectId(imageObject.id);
    } else {
      const fileObject: NoteObject = {
        id: crypto.randomUUID(),
        type: "file",
        x: 96,
        y: scrollTop + 180,
        width: 260,
        height: 76,
        rotation: 0,
        stroke: "#dbe3ef",
        fill: "#ffffff",
        strokeWidth: 1,
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        mimeType: file.type || "application/octet-stream",
        path: assetPath,
      };

      handleObjectsChange([...noteObjects, fileObject]);
      setSelectedObjectId(fileObject.id);
    }

    setActiveTool("select");
    setEditorMode("draw");
  }, [handleObjectsChange, noteObjects, selectedNote]);

  useEffect(() => {
    void (async () => {
      await loadFolders();
      await loadNotes();

      const lastFolderId = localStorage.getItem("lastSelectedFolderId");
      const lastNoteId = localStorage.getItem("lastSelectedNoteId");
      const lastView = localStorage.getItem("lastSelectedView") as NotesView | null;

      if (
        lastView === "favorites" ||
        lastView === "recent" ||
        lastView === "reminders" ||
        lastView === "trash"
      ) {
        setActiveView(lastView);
      }

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
    localStorage.setItem("lastSelectedView", activeView);
  }, [activeView]);

  useEffect(() => {
    if (!selectedNote?.id) {
      setCollapsedPanelsOwnerId(null);
      return;
    }

    const savedPanels = parseCollapsedPanelsState(
      localStorage.getItem(getCollapsedPanelsStorageKey(selectedNote.id))
    );

    setCollapsedPanels(savedPanels ?? DEFAULT_COLLAPSED_PANELS);
    setCollapsedPanelsOwnerId(selectedNote.id);
    setEditorMode("text");
    setActiveTool("freehand");
    setIsShapeMenuOpen(false);
    setSelectedObjectId(null);
    void loadRemindersForNote(selectedNote.id);
    drawingHistoryRef.current = { noteId: selectedNote.id, undo: [], redo: [] };
  }, [loadRemindersForNote, selectedNote?.id]);

  useEffect(() => {
    if (!selectedNote?.id) {
      setNoteReminders([]);
      setReminderDraft(null);
    }
  }, [selectedNote?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) {
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedObjectId) {
        e.preventDefault();
        deleteSelectedObject();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selectedObjectId) {
        e.preventDefault();
        duplicateSelectedObject();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedoObjects();
        } else {
          handleUndoObjects();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedoObjects();
        return;
      }

      if (e.key === "Escape") {
        setSelectedObjectId(null);
        return;
      }

      if (selectedObjectId && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") moveSelectedObject(-step, 0);
        if (e.key === "ArrowRight") moveSelectedObject(step, 0);
        if (e.key === "ArrowUp") moveSelectedObject(0, -step);
        if (e.key === "ArrowDown") moveSelectedObject(0, step);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelectedObject, duplicateSelectedObject, handleRedoObjects, handleUndoObjects, moveSelectedObject, selectedObjectId]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!shapeMenuRef.current?.contains(event.target as Node)) {
        setIsShapeMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!selectedNote?.id || collapsedPanelsOwnerId !== selectedNote.id) {
      return;
    }

    localStorage.setItem(
      getCollapsedPanelsStorageKey(selectedNote.id),
      JSON.stringify(collapsedPanels)
    );
  }, [collapsedPanels, collapsedPanelsOwnerId, selectedNote?.id]);

  useEffect(() => {
    if (selectedNote?.id) {
      localStorage.setItem("lastSelectedNoteId", selectedNote.id);
      return;
    }

    localStorage.removeItem("lastSelectedNoteId");
  }, [selectedNote]);

  useEffect(() => {
    if (!debouncedNote || debouncedNote.deletedAt) {
      return;
    }

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

  useEffect(() => {
    const unsubscribeDue = window.notesApi.reminders.onDue((payload) => {
      setDueReminderNotice(payload);
      void loadNotes();
      if (selectedNote?.id === payload.noteId) {
        void loadRemindersForNote(payload.noteId);
      }
    });

    const unsubscribeOpen = window.notesApi.reminders.onOpenNote((noteId) => {
      void handleSelectNote(noteId);
      setIsReminderPanelOpen(true);
    });

    return () => {
      unsubscribeDue();
      unsubscribeOpen();
    };
  }, [loadRemindersForNote, selectedNote?.id]);

  const handleCreateNote = async () => {
    setActiveView("all");
    const id = await createNote(selectedFolderId);
    const note = await getNoteById(id);
    setSelectedNote(note);
    await loadNotes();
  };

  const handleSelectNote = async (noteId: string) => {
    const note = await getNoteById(noteId);
    if (!note) {
      return;
    }

    setSelectedNote(note);
    setIsReminderPanelOpen(false);
  };

  const handleEditorContentChange = (value: string) => {
    setSelectedNote((current) =>
      current && !current.deletedAt ? { ...current, content: value } : current
    );
  };

  const handleToggleMark = (mark: "bold" | "italic" | "underline" | "highlight") => {
    if (!selectedNote || selectedNote.deletedAt) {
      return;
    }

    richEditorRef.current?.toggleMark(mark);
  };

  const handleToggleList = (type: "numbered-list" | "bulleted-list") => {
    if (!selectedNote || selectedNote.deletedAt) {
      return;
    }

    richEditorRef.current?.toggleList(type);
  };

  const handleInsertInlineSketch = () => {
    if (!selectedNote || selectedNote.deletedAt) {
      return;
    }

    richEditorRef.current?.insertSketch();
  };

  const handleToggleFavorite = async () => {
    if (!selectedNote || selectedNote.deletedAt) {
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

  const handleSoftDeleteNote = async () => {
    if (!selectedNote) {
      return;
    }

    await deleteNote(selectedNote.id);
    setIsTrashPanelOpen(true);
    setSelectedNote(null);
    localStorage.removeItem("lastSelectedNoteId");
    setSaveStatus("saved");
    await loadNotes();
  };

  const handleRestoreSelectedNote = async () => {
    if (!selectedNote?.deletedAt) {
      return;
    }

    await restoreNote(selectedNote.id);
    const restoredNote = await getNoteById(selectedNote.id);
    setSelectedNote(restoredNote);
    setActiveView("all");
    setSaveStatus("saved");
    await loadNotes();
    if (restoredNote?.id) {
      await loadRemindersForNote(restoredNote.id);
    }
  };

  const handlePurgeSelectedNote = async () => {
    if (!selectedNote) {
      return;
    }

    await purgeNote(selectedNote.id);
    setSelectedNote(null);
    localStorage.removeItem("lastSelectedNoteId");
    setSaveStatus("saved");
    await loadNotes();
  };

  const handleRestoreNoteById = async (noteId: string) => {
    await restoreNote(noteId);
    if (selectedNote?.id === noteId) {
      const restoredNote = await getNoteById(noteId);
      setSelectedNote(restoredNote);
    }
    setActiveView("all");
    await loadNotes();
  };

  const handlePurgeNoteById = async (noteId: string) => {
    await purgeNote(noteId);
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
    }
    await loadNotes();
  };

  const handleRestoreAllTrash = async () => {
    await Promise.all(trashNotes.map((note) => restoreNote(note.id)));
    setActiveView("all");
    await loadNotes();
  };

  const handlePurgeAllTrash = async () => {
    await Promise.all(trashNotes.map((note) => purgeNote(note.id)));
    if (selectedNote?.deletedAt) {
      setSelectedNote(null);
    }
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
      setSaveStatus("saved");
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Could not create folder.");
    }
  };

  const handleDroppedFiles = async (files: FileList | File[]) => {
    const nextFiles = Array.from(files);

    for (const file of nextFiles) {
      await handleInlineAssetInsert(file);
    }
  };

  const handleImagePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    for (const file of files) {
      await handleInlineAssetInsert(file);
    }

    event.target.value = "";
  };

  const handleFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    for (const file of files) {
      await handleInlineAssetInsert(file);
    }

    event.target.value = "";
  };

  const handleReminderDraftChange = (updates: Partial<Reminder>) => {
    setReminderDraft((current) => {
      if (!current) {
        return current;
      }

      return { ...current, ...updates };
    });
  };

  const handleSaveReminder = async () => {
    if (!selectedNote?.id || !reminderDraft) {
      return;
    }

    const nextReminder: Reminder = {
      ...reminderDraft,
      noteId: selectedNote.id,
      id: activeReminder?.id ?? reminderDraft.id,
      createdAt: activeReminder?.createdAt ?? reminderDraft.createdAt,
      status: "active",
      triggeredAt: null,
    };

    await upsertReminder(nextReminder);
    await loadRemindersForNote(selectedNote.id);
    const refreshedNote = await getNoteById(selectedNote.id);
    setSelectedNote(refreshedNote);
    await loadNotes();
    setIsReminderPanelOpen(false);
  };

  const handleDeleteReminder = async () => {
    if (!activeReminder || !selectedNote?.id) {
      return;
    }

    await deleteReminder(activeReminder.id);
    await loadRemindersForNote(selectedNote.id);
    const refreshedNote = await getNoteById(selectedNote.id);
    setSelectedNote(refreshedNote);
    await loadNotes();
    setIsReminderPanelOpen(false);
  };

  const handleOpenReminderPanel = () => {
    if (!selectedNote?.id) {
      return;
    }

    setReminderDraft(activeReminder ?? createDefaultReminder(selectedNote.id));
    setIsReminderPanelOpen(true);
  };

  const handleSnoozeDueReminder = async (minutes: number) => {
    if (!dueReminderNotice) {
      return;
    }

    const snoozedUntilIso = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    await snoozeReminder(dueReminderNotice.reminder.id, snoozedUntilIso);
    if (selectedNote?.id === dueReminderNotice.noteId) {
      await loadRemindersForNote(dueReminderNotice.noteId);
    }
    await loadNotes();
    setDueReminderNotice(null);
  };

  const handleExportSelectedNote = () => {
    if (!selectedNote) {
      return;
    }

    const exportBlob = new Blob(
      [
        JSON.stringify(
          {
            title: selectedNote.title,
            content: selectedNote.content,
            tags: selectedNote.tags,
            objects: noteObjects,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );

    const link = document.createElement("a");
    link.href = URL.createObjectURL(exportBlob);
    link.download = `${(selectedNote.title || "note").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const isSelectedNoteDeleted = Boolean(selectedNote?.deletedAt);

  const emptyStateCopy =
    activeView === "trash"
      ? "Deleted notes stay here until you restore or permanently remove them."
      : activeView === "reminders"
        ? "Set a reminder on any note and it will appear here until it fires."
        : activeView === "favorites"
          ? "Mark any note as a favorite and it will appear here."
          : "Create a note or broaden your search to see results here.";

  return (
    <div className="app-shell">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => void handleImagePicked(event)}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => void handleFilePicked(event)}
      />

      <div className="desktop-card">
        <AppSidebar
          activeView={activeView}
          selectedFolderId={selectedFolderId}
          collapsedPanels={collapsedPanels}
          setCollapsedPanels={setCollapsedPanels}
          isCreatingFolder={isCreatingFolder}
          setIsCreatingFolder={setIsCreatingFolder}
          newFolderName={newFolderName}
          setNewFolderName={setNewFolderName}
          folderError={folderError}
          setFolderError={setFolderError}
          folders={folders}
          visibleNotes={visibleNotes}
          selectedNoteId={selectedNote?.id ?? null}
          activeCollectionLabel={activeCollectionLabel}
          emptyStateCopy={emptyStateCopy}
          search={search}
          onSearchChange={setSearch}
          reminderCount={reminderCount}
          trashCount={trashNotes.length}
          getNotePreview={getNotePreview}
          onCreateFolder={handleCreateFolder}
          onSelectNote={handleSelectNote}
          onSelectAllNotes={() => {
            setActiveView("all");
            setSelectedFolderId(null);
            localStorage.removeItem("lastSelectedFolderId");
          }}
          onSelectFavorites={() => {
            setActiveView("favorites");
            setSelectedFolderId(null);
          }}
          onSelectRecent={() => {
            setActiveView("recent");
            setSelectedFolderId(null);
          }}
          onSelectReminders={() => {
            setActiveView("reminders");
            setSelectedFolderId(null);
            setIsReminderPanelOpen(true);
          }}
          onSelectTrash={() => {
            setActiveView("trash");
            setSelectedFolderId(null);
            setIsTrashPanelOpen(true);
          }}
          onSelectFolder={(folderId) => {
            setActiveView("all");
            setSelectedFolderId(folderId);
            localStorage.setItem("lastSelectedFolderId", folderId);
          }}
          onOpenTags={() => {
            setActiveView("all");
            setSelectedFolderId(null);
          }}
        />

        <main className="editor-area">
          <div className="editor-topbar">
            <div className="topbar-actions">
              <span className="saved-pill">
                {isSelectedNoteDeleted
                  ? "In trash"
                  : saveStatus === "saving"
                    ? "Saving..."
                    : saveStatus === "saved"
                      ? "All changes saved"
                      : "Ready"}
              </span>
              <button className="top-icon-btn" onClick={() => void handleCreateNote()}>
                <FiPlus />
              </button>
                <button className="top-icon-btn" type="button" onClick={() => setIsReminderPanelOpen((current) => !current)}>
                  <FiBell />
                </button>
                <button className="top-icon-btn" type="button" onClick={() => setIsTrashPanelOpen((current) => !current)}>
                  <FiTrash2 />
                </button>
            </div>
          </div>

          <div
            className={isDropTargetActive ? "editor-scroll is-drop-target" : "editor-scroll"}
            onDragEnter={(event) => {
              if (isSelectedNoteDeleted) {
                return;
              }

              if (event.dataTransfer.types.includes("Files")) {
                dragDepthRef.current += 1;
                setIsDropTargetActive(true);
              }
            }}
            onDragOver={(event) => {
              if (isSelectedNoteDeleted) {
                return;
              }

              if (event.dataTransfer.types.includes("Files")) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }
            }}
            onDragLeave={() => {
              dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

              if (dragDepthRef.current === 0) {
                setIsDropTargetActive(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              dragDepthRef.current = 0;
              setIsDropTargetActive(false);

              if (!isSelectedNoteDeleted) {
                void handleDroppedFiles(event.dataTransfer.files);
              }
            }}
          >
            {selectedNote ? (
              <>
                <div className="note-header note-header-rich">
                  <div className="note-header-main">
                    <div className="note-title-row">
                      <input
                        className="note-title"
                        value={selectedNote.title}
                        disabled={isSelectedNoteDeleted}
                        onChange={(event) =>
                          setSelectedNote({ ...selectedNote, title: event.target.value })
                        }
                      />
                      <button
                        className={selectedNote.isFavorite ? "top-icon-btn favorite-toggle active" : "top-icon-btn favorite-toggle"}
                        type="button"
                        disabled={isSelectedNoteDeleted}
                        onClick={() => void handleToggleFavorite()}
                      >
                        <FiStar />
                      </button>
                    </div>
                    <div className="note-date subtle-row">
                      <span>{selectedNoteDateLabel}</span>
                      <span>{getRelativeLastEditedLabel(selectedNote.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="note-header-actions">
                    <span className="saved-pill">
                      {isSelectedNoteDeleted
                        ? "In trash"
                        : saveStatus === "saving"
                          ? "Saving..."
                          : saveStatus === "saved"
                            ? "All changes saved"
                            : "Ready"}
                    </span>
                    <button className="tool-btn" type="button" disabled={isSelectedNoteDeleted} onClick={handleOpenReminderPanel}>
                      <FiBell />
                      <span>Reminder</span>
                    </button>
                    <button className="top-icon-btn" type="button" onClick={handleExportSelectedNote}>
                      <FiUpload />
                    </button>
                    <button className="top-icon-btn" type="button">
                      <FiMoreVertical />
                    </button>
                  </div>
                </div>

                <div className="format-toolbar">
                  <div className="format-group">
                    <button
                      className="format-btn"
                      type="button"
                      disabled={isSelectedNoteDeleted}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleToggleMark("bold");
                      }}
                    >
                      <MdFormatBold />
                    </button>
                    <button
                      className="format-btn"
                      type="button"
                      disabled={isSelectedNoteDeleted}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleToggleMark("italic");
                      }}
                    >
                      <MdFormatItalic />
                    </button>
                    <button
                      className="format-btn"
                      type="button"
                      disabled={isSelectedNoteDeleted}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleToggleMark("underline");
                      }}
                    >
                      <MdFormatUnderlined />
                    </button>
                    <button
                      className="format-btn highlight-btn"
                      type="button"
                      disabled={isSelectedNoteDeleted}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleToggleMark("highlight");
                      }}
                    >
                      H
                    </button>
                    <button
                      className="format-btn"
                      type="button"
                      disabled={isSelectedNoteDeleted}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleToggleList("numbered-list");
                      }}
                    >
                      <MdChecklist />
                    </button>
                    <button
                      className="format-btn"
                      type="button"
                      disabled={isSelectedNoteDeleted}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleToggleList("bulleted-list");
                      }}
                    >
                      <MdFormatListBulleted />
                    </button>
                    <button
                      className="format-btn"
                      type="button"
                      disabled={isSelectedNoteDeleted}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleToggleList("numbered-list");
                      }}
                    >
                      <MdFormatListNumbered />
                    </button>
                    <button
                      className="format-btn format-sketch-btn"
                      type="button"
                      disabled={isSelectedNoteDeleted}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleInsertInlineSketch();
                      }}
                    >
                      <LuPenTool />
                      <span>Insert sketch here</span>
                    </button>
                    <button className="tool-btn" type="button" disabled={isSelectedNoteDeleted} onClick={() => imageInputRef.current?.click()}>
                      <FiImage />
                      <span>Image</span>
                    </button>
                    <button className="tool-btn" type="button" disabled={isSelectedNoteDeleted} onClick={() => fileInputRef.current?.click()}>
                      <FiPaperclip />
                      <span>File</span>
                    </button>
                  </div>
                  <div className="header-tools">
                    {isSelectedNoteDeleted ? (
                      <>
                        <button className="tool-btn active" type="button" onClick={() => void handleRestoreSelectedNote()}>
                          <FiRotateCcw />
                          <span>Restore</span>
                        </button>
                        <button className="tool-btn danger" type="button" onClick={() => void handlePurgeSelectedNote()}>
                          <FiTrash2 />
                          <span>Delete forever</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="tool-btn" type="button">
                          <LuBrainCircuit />
                          <span>AI Assist</span>
                        </button>
                        <button className="tool-btn danger" type="button" onClick={() => void handleSoftDeleteNote()}>
                          <FiTrash2 />
                          <span>Move to trash</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isSelectedNoteDeleted ? (
                  <div className="trash-banner">
                    This note is in the trash. Restore it to continue editing, or delete it forever.
                  </div>
                ) : null}

                <div className="meta-strip">
                  <select
                    value={selectedNote.folderId ?? ""}
                    disabled={isSelectedNoteDeleted}
                    onChange={(event) =>
                      setSelectedNote({
                        ...selectedNote,
                        folderId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">Notebook</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>

                  <input
                    placeholder="Tags"
                    value={selectedNote.tags}
                    disabled={isSelectedNoteDeleted}
                    onChange={(event) =>
                      setSelectedNote({ ...selectedNote, tags: event.target.value })
                    }
                  />

                  <button className="meta-reminder-trigger" type="button" disabled={isSelectedNoteDeleted} onClick={handleOpenReminderPanel}>
                    <FiCalendar />
                    <span>
                      {activeReminder
                        ? `${activeReminder.date} ${activeReminder.time}`
                        : "Set reminder"}
                    </span>
                  </button>
                </div>

                <div className="note-body-scroll" ref={paperScrollRef}>
                  <div ref={paperSurfaceRef} className={`paper-surface${editorMode === "draw" ? " draw-mode" : ""}`}>
                    <div className="text-layer">
                      <RichTextEditor
                        ref={richEditorRef}
                        value={selectedNote.content}
                        readOnly={isSelectedNoteDeleted || editorMode === "draw"}
                        placeholder="Start writing your thoughts..."
                        onChange={handleEditorContentChange}
                      />
                    </div>
                    <DrawingLayer
                      objects={noteObjects}
                      onChange={handleObjectsChange}
                      activeTool={editorMode === "draw" ? activeTool : "view"}
                      selectedId={selectedObjectId}
                      onSelect={setSelectedObjectId}
                      surfaceRef={paperSurfaceRef}
                      drawColor={drawColor}
                    />
                    <ObjectLayer
                      objects={noteObjects}
                      onChange={handleObjectsChange}
                      activeTool={editorMode === "draw" ? activeTool : "view"}
                      selectedId={selectedObjectId}
                      onSelect={setSelectedObjectId}
                      surfaceRef={paperSurfaceRef}
                      onLabelCreate={handleLabelCreate}
                    />
                  </div>
                </div>

                {selectedObject ? (
                  <SelectedObjectToolbar
                    selectedObject={selectedObject}
                    updateSelectedObject={updateSelectedObject}
                    onBringForward={() => moveSelectedLayer(1)}
                    onSendBackward={() => moveSelectedLayer(-1)}
                    onDuplicate={duplicateSelectedObject}
                    onDelete={deleteSelectedObject}
                  />
                ) : null}

                <DrawingToolbar
                  editorMode={editorMode}
                  isSelectedNoteDeleted={isSelectedNoteDeleted}
                  activeTool={activeTool}
                  activeShapeLabel={activeShapeLabel}
                  isShapeMenuOpen={isShapeMenuOpen}
                  selectedObject={selectedObject}
                  selectedObjectId={selectedObjectId}
                  drawColor={drawColor}
                  canUndo={drawingHistoryRef.current.undo.length > 0}
                  canRedo={drawingHistoryRef.current.redo.length > 0}
                  canClear={noteObjects.length > 0}
                  shapeOptions={SHAPE_OPTIONS}
                  shapeMenuRef={shapeMenuRef}
                  onTextMode={() => {
                    setEditorMode("text");
                    setSelectedObjectId(null);
                    setIsShapeMenuOpen(false);
                  }}
                  onSelectTool={() => {
                    setEditorMode("draw");
                    setActiveTool("select");
                    setIsShapeMenuOpen(false);
                  }}
                  onPenTool={() => {
                    setEditorMode("draw");
                    setActiveTool("freehand");
                    setIsShapeMenuOpen(false);
                  }}
                  onToggleShapeMenu={() => {
                    setEditorMode("draw");
                    setIsShapeMenuOpen((current) => !current);
                  }}
                  onChooseShape={(shape) => {
                    setEditorMode("draw");
                    setActiveTool(shape);
                    setIsShapeMenuOpen(false);
                  }}
                  onArrowTool={() => {
                    setEditorMode("draw");
                    setActiveTool("arrow");
                    setIsShapeMenuOpen(false);
                  }}
                  onLabelTool={() => {
                    setEditorMode("draw");
                    setActiveTool("label");
                    setIsShapeMenuOpen(false);
                  }}
                  onDrawColorChange={handleDrawColorChange}
                  onUndo={handleUndoObjects}
                  onRedo={handleRedoObjects}
                  onDeleteSelected={deleteSelectedObject}
                  onClear={handleClearDrawings}
                  onInsertImage={() => imageInputRef.current?.click()}
                  onInsertFile={() => fileInputRef.current?.click()}
                />

                <ReminderPanel
                  isOpen={isReminderPanelOpen}
                  reminder={reminderDraft ?? createDefaultReminder(selectedNote.id)}
                  isDisabled={isSelectedNoteDeleted}
                  onChange={handleReminderDraftChange}
                  onCancel={() => {
                    setIsReminderPanelOpen(false);
                    setReminderDraft(activeReminder ?? createDefaultReminder(selectedNote.id));
                  }}
                  onSave={() => void handleSaveReminder()}
                  onDelete={activeReminder ? () => void handleDeleteReminder() : undefined}
                />
              </>
            ) : (
              <div className="empty-editor-state">
                <FiBookOpen className="empty-editor-icon" />
                <h1>Select or create a note</h1>
                <p>Your notes stay local, autosave as you type, and feel like a real notebook.</p>
                <button className="tool-btn active large" onClick={() => void handleCreateNote()}>
                  <FiPlus />
                  <span>Create note</span>
                </button>
              </div>
            )}

            {isDropTargetActive ? (
              <div className="drop-target-overlay">
                <strong>Drop files here</strong>
                <span>Images and files will be inserted directly into the paper note.</span>
              </div>
            ) : null}

            {dueReminderNotice ? (
              <div className="due-reminder-toast">
                <div>
                  <strong>{dueReminderNotice.noteTitle || "Reminder"}</strong>
                  <p>{dueReminderNotice.reminder.message || "A note reminder is due."}</p>
                </div>
                <div className="due-reminder-actions">
                  <button className="tool-btn" type="button" onClick={() => void handleSelectNote(dueReminderNotice.noteId)}>
                    Open note
                  </button>
                  <button className="tool-btn" type="button" onClick={() => void handleSnoozeDueReminder(10)}>
                    Snooze 10m
                  </button>
                  <button className="tool-btn" type="button" onClick={() => setDueReminderNotice(null)}>
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}

            <TrashPanel
              notes={isTrashPanelOpen ? trashNotes : []}
              onSelectNote={(noteId) => {
                void handleSelectNote(noteId);
                setActiveView("trash");
              }}
              onClose={() => setIsTrashPanelOpen(false)}
              onViewTrash={() => setActiveView("trash")}
              onRestoreNote={(noteId) => void handleRestoreNoteById(noteId)}
              onPurgeNote={(noteId) => void handlePurgeNoteById(noteId)}
              onRestoreAll={() => void handleRestoreAllTrash()}
              onPurgeAll={() => void handlePurgeAllTrash()}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
