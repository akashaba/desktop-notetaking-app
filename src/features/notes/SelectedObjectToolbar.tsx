import { isLabelObject, isShapeObject, type NoteObject } from "./noteModel";

type SelectedObjectToolbarProps = {
  selectedObject: NoteObject;
  updateSelectedObject: (updater: (object: NoteObject) => NoteObject) => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function SelectedObjectToolbar({
  selectedObject,
  updateSelectedObject,
  onBringForward,
  onSendBackward,
  onDuplicate,
  onDelete,
}: SelectedObjectToolbarProps) {
  return (
    <div className="object-transform-toolbar">
      {isShapeObject(selectedObject) ? (
        <>
          <label className="transform-control">
            <span>Stroke</span>
            <input
              type="color"
              value={selectedObject.stroke}
              onChange={(event) => updateSelectedObject((object) => ({ ...object, stroke: event.target.value }))}
            />
          </label>
          <label className="transform-control">
            <span>Fill</span>
            <input
              type="color"
              value={selectedObject.fill === "transparent" ? "#ffffff" : selectedObject.fill}
              onChange={(event) => updateSelectedObject((object) => ({ ...object, fill: event.target.value }))}
            />
          </label>
          <label className="transform-control narrow">
            <span>Stroke</span>
            <input
              type="number"
              min={1}
              max={12}
              value={selectedObject.strokeWidth}
              onChange={(event) =>
                updateSelectedObject((object) => ({
                  ...object,
                  strokeWidth: Math.max(1, Number(event.target.value) || 1),
                }))
              }
            />
          </label>
        </>
      ) : null}

      {isLabelObject(selectedObject) ? (
        <>
          <label className="transform-control">
            <span>Text</span>
            <input
              type="color"
              value={selectedObject.textColor}
              onChange={(event) =>
                updateSelectedObject((object) =>
                  isLabelObject(object) ? { ...object, textColor: event.target.value } : object
                )
              }
            />
          </label>
          <label className="transform-control narrow">
            <span>Font</span>
            <input
              type="number"
              min={12}
              max={72}
              value={selectedObject.fontSize}
              onChange={(event) =>
                updateSelectedObject((object) =>
                  isLabelObject(object)
                    ? { ...object, fontSize: Math.max(12, Number(event.target.value) || 12) }
                    : object
                )
              }
            />
          </label>
        </>
      ) : null}

      <button className="tool-btn" type="button" onClick={onBringForward}>
        <span>Bring forward</span>
      </button>
      <button className="tool-btn" type="button" onClick={onSendBackward}>
        <span>Send backward</span>
      </button>
      <button className="tool-btn" type="button" onClick={onDuplicate}>
        <span>Duplicate</span>
      </button>
      <button className="tool-btn danger" type="button" onClick={onDelete}>
        <span>Delete</span>
      </button>
    </div>
  );
}