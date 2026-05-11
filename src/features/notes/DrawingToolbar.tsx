import { FiArrowUpRight, FiChevronDown, FiEdit2, FiImage, FiMousePointer, FiPaperclip, FiRotateCcw, FiSquare, FiTrash2, FiType } from "react-icons/fi";
import { LuBrainCircuit, LuPenTool } from "react-icons/lu";
import type { RefObject } from "react";
import { isLabelObject, isShapeObject, type NoteObject } from "./noteModel";
import type { DrawTool, ShapeTool } from "./DrawingLayer";

type DrawingToolbarProps = {
  editorMode: "text" | "draw";
  isSelectedNoteDeleted: boolean;
  activeTool: DrawTool;
  activeShapeLabel: string;
  isShapeMenuOpen: boolean;
  selectedObject: NoteObject | null;
  selectedObjectId: string | null;
  drawColor: string;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  shapeOptions: Array<{ tool: ShapeTool; label: string }>;
  shapeMenuRef: RefObject<HTMLDivElement | null>;
  onTextMode: () => void;
  onSelectTool: () => void;
  onPenTool: () => void;
  onToggleShapeMenu: () => void;
  onChooseShape: (shape: ShapeTool) => void;
  onArrowTool: () => void;
  onLabelTool: () => void;
  onDrawColorChange: (color: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  onClear: () => void;
  onInsertImage: () => void;
  onInsertFile: () => void;
};

export function DrawingToolbar({
  editorMode,
  isSelectedNoteDeleted,
  activeTool,
  activeShapeLabel,
  isShapeMenuOpen,
  selectedObject,
  selectedObjectId,
  drawColor,
  canUndo,
  canRedo,
  canClear,
  shapeOptions,
  shapeMenuRef,
  onTextMode,
  onSelectTool,
  onPenTool,
  onToggleShapeMenu,
  onChooseShape,
  onArrowTool,
  onLabelTool,
  onDrawColorChange,
  onUndo,
  onRedo,
  onDeleteSelected,
  onClear,
  onInsertImage,
  onInsertFile,
}: DrawingToolbarProps) {
  return (
    <div className="bottom-toolbar sticky-toolbar" ref={shapeMenuRef}>
      <button className={editorMode === "text" ? "tool-btn active" : "tool-btn"} type="button" disabled={isSelectedNoteDeleted} onClick={onTextMode}>
        <FiEdit2 />
        <span>Text</span>
      </button>

      <button className={editorMode === "draw" && activeTool === "select" ? "tool-btn active" : "tool-btn"} type="button" disabled={isSelectedNoteDeleted} title="Select / move objects" onClick={onSelectTool}>
        <FiMousePointer />
        <span>Select</span>
      </button>
      <button className={editorMode === "draw" && activeTool === "freehand" ? "tool-btn active" : "tool-btn"} type="button" disabled={isSelectedNoteDeleted} title="Freehand pen" onClick={onPenTool}>
        <LuPenTool />
        <span>Pen</span>
      </button>

      <div className="shape-menu-wrap">
        <button className={editorMode === "draw" && shapeOptions.some((shape) => shape.tool === activeTool) ? "tool-btn active" : "tool-btn"} type="button" disabled={isSelectedNoteDeleted} title="Choose shape" onClick={onToggleShapeMenu}>
          <FiSquare />
          <span>{activeShapeLabel}</span>
          <FiChevronDown />
        </button>
        {isShapeMenuOpen ? (
          <div className="shape-menu-popover">
            {shapeOptions.map((shape) => (
              <button key={shape.tool} className={activeTool === shape.tool ? "shape-menu-item active" : "shape-menu-item"} type="button" onClick={() => onChooseShape(shape.tool)}>
                <span>{shape.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <button className={editorMode === "draw" && activeTool === "arrow" ? "tool-btn active" : "tool-btn"} type="button" disabled={isSelectedNoteDeleted} title="Arrow" onClick={onArrowTool}>
        <FiArrowUpRight />
        <span>Arrow</span>
      </button>
      <button className={editorMode === "draw" && activeTool === "label" ? "tool-btn active" : "tool-btn"} type="button" disabled={isSelectedNoteDeleted} title="Add text label" onClick={onLabelTool}>
        <FiType />
        <span>Label</span>
      </button>

      {editorMode === "draw" ? (
        <label className="tool-btn" title="Stroke / label color" style={{ padding: "0 6px", gap: 4, cursor: "pointer" }}>
          <span
            style={{
              display: "inline-block",
              width: 16,
              height: 16,
              borderRadius: 3,
              background: drawColor,
              border: "1.5px solid #94a3b8",
              flexShrink: 0,
            }}
          />
          <span>Color</span>
          <input
            type="color"
            value={drawColor}
            style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
            onChange={(event) => onDrawColorChange(event.target.value)}
            tabIndex={-1}
          />
        </label>
      ) : null}

      <button className="tool-btn" type="button" title="Undo" disabled={!canUndo} onClick={onUndo}>
        <FiRotateCcw />
        <span>Undo</span>
      </button>
      <button className="tool-btn" type="button" title="Redo" disabled={!canRedo} onClick={onRedo}>
        <FiRotateCcw style={{ transform: "scaleX(-1)" }} />
        <span>Redo</span>
      </button>
      <button className="tool-btn" type="button" title="Delete selected object" disabled={!selectedObjectId} onClick={onDeleteSelected}>
        <FiTrash2 />
        <span>Delete Selected</span>
      </button>
      <button className="tool-btn" type="button" title="Clear all canvas objects" disabled={!canClear} onClick={onClear}>
        <FiTrash2 />
        <span>Clear</span>
      </button>

      <span className="toolbar-divider" />

      <button className="tool-btn" type="button" disabled={isSelectedNoteDeleted} title="Insert image onto note" onClick={onInsertImage}>
        <FiImage />
        <span>Image</span>
      </button>
      <button className="tool-btn" type="button" disabled={isSelectedNoteDeleted} onClick={onInsertFile}>
        <FiPaperclip />
        <span>File</span>
      </button>
      <button className="tool-btn" type="button">
        <LuBrainCircuit />
        <span>AI Assist</span>
      </button>
    </div>
  );
}