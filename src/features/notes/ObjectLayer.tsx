import { FiFileText, FiImage, FiMusic, FiPackage, FiPlayCircle } from "react-icons/fi";
import { useCallback, useMemo, useRef, useState } from "react";
import type { FileObject, ImageObject, LabelObject, NoteObject, ObjectPoint } from "./noteModel";
import { isFileObject, isImageObject, isLabelObject } from "./noteModel";
import type { DrawTool } from "./DrawingLayer";

type ObjectLayerProps = {
  objects: NoteObject[];
  onChange: (objects: NoteObject[]) => void;
  activeTool: DrawTool;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  onLabelCreate: (x: number, y: number) => void;
};

type CornerHandle = "nw" | "ne" | "sw" | "se";

const MIN_SIZE = 20;
const SEL_COLOR = "#2563eb";

function getAngle(center: ObjectPoint, point: ObjectPoint) {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

function resizeBox(
  object: ImageObject | FileObject,
  handle: CornerHandle,
  dx: number,
  dy: number,
  keepAspect: boolean
) {
  let left = object.x;
  let top = object.y;
  let right = object.x + object.width;
  let bottom = object.y + object.height;
  const aspectRatio = object.width / Math.max(1, object.height);

  if (handle === "nw") {
    left += dx;
    top += dy;
  } else if (handle === "ne") {
    right += dx;
    top += dy;
  } else if (handle === "sw") {
    left += dx;
    bottom += dy;
  } else if (handle === "se") {
    right += dx;
    bottom += dy;
  }

  let width = Math.max(MIN_SIZE, Math.abs(right - left));
  let height = Math.max(MIN_SIZE, Math.abs(bottom - top));

  if (keepAspect) {
    if (width / Math.max(1, height) > aspectRatio) {
      width = Math.max(MIN_SIZE, Math.round(height * aspectRatio));
    } else {
      height = Math.max(MIN_SIZE, Math.round(width / aspectRatio));
    }

    if (handle === "nw" || handle === "sw") {
      left = right - width;
    }

    if (handle === "nw" || handle === "ne") {
      top = bottom - height;
    }
  }

  return {
    ...object,
    x: Math.round(Math.min(left, right)),
    y: Math.round(Math.min(top, bottom)),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function toAssetUrl(assetPath: string) {
  if (assetPath.startsWith("data:") || assetPath.startsWith("http://") || assetPath.startsWith("https://") || assetPath.startsWith("file://")) {
    return assetPath;
  }

  return encodeURI(`file:///${assetPath.replace(/\\/g, "/")}`);
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return FiImage;
  }

  if (mimeType.startsWith("audio/")) {
    return FiMusic;
  }

  if (mimeType.startsWith("video/")) {
    return FiPlayCircle;
  }

  if (mimeType.includes("zip") || mimeType.includes("compressed")) {
    return FiPackage;
  }

  return FiFileText;
}

function TransformHandles({
  width,
  height,
  rotation,
  onResizeStart,
  onRotateStart,
  showResize,
}: {
  width: number;
  height: number;
  rotation: number;
  onResizeStart?: (event: React.PointerEvent, handle: CornerHandle) => void;
  onRotateStart: (event: React.PointerEvent) => void;
  showResize: boolean;
}) {
  return (
    <div className="object-overlay" style={{ transform: `rotate(${rotation}deg)` }}>
      <div className="object-selection-outline" style={{ width, height, borderColor: SEL_COLOR }} />
      <div className="object-rotate-stem" style={{ left: width / 2, top: -20 }} />
      <button className="object-rotate-handle" style={{ left: width / 2 - 7, top: -34 }} onPointerDown={onRotateStart} />
      {showResize && onResizeStart
        ? [
            { handle: "nw", left: -6, top: -6 },
            { handle: "ne", left: width - 6, top: -6 },
            { handle: "sw", left: -6, top: height - 6 },
            { handle: "se", left: width - 6, top: height - 6 },
          ].map((corner) => (
            <button
              key={corner.handle}
              className="object-corner-handle"
              style={{ left: corner.left, top: corner.top }}
              onPointerDown={(event) => onResizeStart(event, corner.handle as CornerHandle)}
            />
          ))
        : null}
    </div>
  );
}

export function ObjectLayer({ objects, onChange, activeTool, selectedId, onSelect, surfaceRef, onLabelCreate }: ObjectLayerProps) {
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);

  const labelObjects = useMemo(() => objects.filter(isLabelObject), [objects]);
  const imageObjects = useMemo(() => objects.filter(isImageObject), [objects]);
  const fileObjects = useMemo(() => objects.filter(isFileObject), [objects]);

  const getPaperPt = useCallback((clientX: number, clientY: number) => {
    const surface = surfaceRef.current;
    if (!surface) {
      return { x: 0, y: 0 };
    }

    const rect = surface.getBoundingClientRect();
    return {
      x: Math.round(clientX - rect.left),
      y: Math.round(clientY - rect.top),
    };
  }, [surfaceRef]);

  const updateObject = useCallback((objectId: string, nextObject: NoteObject) => {
    onChange(objectsRef.current.map((object) => (object.id === objectId ? nextObject : object)));
  }, [onChange]);

  const startDrag = useCallback((event: React.PointerEvent, object: LabelObject | ImageObject | FileObject) => {
    if (activeTool !== "select") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onSelect(object.id);
    const startPt = getPaperPt(event.clientX, event.clientY);
    const snapshot = { ...object };

    const onMove = (pointerEvent: PointerEvent) => {
      const current = getPaperPt(pointerEvent.clientX, pointerEvent.clientY);
      updateObject(object.id, { ...snapshot, x: snapshot.x + current.x - startPt.x, y: snapshot.y + current.y - startPt.y });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [activeTool, getPaperPt, onSelect, updateObject]);

  const startRotate = useCallback((event: React.PointerEvent, object: LabelObject | ImageObject | FileObject) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(object.id);
    const center = { x: object.x + object.width / 2, y: object.y + object.height / 2 };
    const startPt = getPaperPt(event.clientX, event.clientY);
    const startAngle = getAngle(center, startPt);
    const initialRotation = object.rotation;

    const onMove = (pointerEvent: PointerEvent) => {
      const current = getPaperPt(pointerEvent.clientX, pointerEvent.clientY);
      updateObject(object.id, { ...object, rotation: Math.round(initialRotation + getAngle(center, current) - startAngle) });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [getPaperPt, onSelect, updateObject]);

  const startResizeObject = useCallback((event: React.PointerEvent, object: ImageObject | FileObject, handle: CornerHandle) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(object.id);
    const startPt = getPaperPt(event.clientX, event.clientY);
    const snapshot = { ...object };

    const onMove = (pointerEvent: PointerEvent) => {
      const current = getPaperPt(pointerEvent.clientX, pointerEvent.clientY);
      updateObject(object.id, resizeBox(snapshot, handle, current.x - startPt.x, current.y - startPt.y, pointerEvent.shiftKey && object.type === "image"));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [getPaperPt, onSelect, updateObject]);

  const handleLayerPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === "label") {
      const target = event.target as HTMLElement;
      if (target.closest(".label-object") || target.closest(".image-object") || target.closest(".file-object")) {
        return;
      }

      const point = getPaperPt(event.clientX, event.clientY);
      onLabelCreate(point.x, point.y);
      return;
    }

    if (activeTool === "select" && (event.target as HTMLElement).classList.contains("object-layer")) {
      setEditingLabelId(null);
      onSelect(null);
    }
  }, [activeTool, getPaperPt, onLabelCreate, onSelect]);

  const layerPointerEvents: React.CSSProperties["pointerEvents"] =
    activeTool === "label" ? "auto" : "none";

  return (
    <div className="object-layer" style={{ pointerEvents: layerPointerEvents }} onPointerDown={handleLayerPointerDown}>
      {labelObjects.map((object) => {
        const isSelected = object.id === selectedId;
        const isEditing = editingLabelId === object.id;
        return (
          <div
            key={object.id}
            className={`label-object${isSelected ? " selected" : ""}`}
            style={{ left: object.x, top: object.y, width: object.width, height: object.height, transform: `rotate(${object.rotation}deg)`, transformOrigin: "center center", pointerEvents: "auto" }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelect(object.id);
              if (activeTool === "select" && !isEditing) {
                startDrag(event, object);
              }
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (activeTool === "select") {
                onSelect(object.id);
                setEditingLabelId(object.id);
              }
            }}
          >
            <textarea
              className="label-object-input"
              value={object.text}
              readOnly={!isEditing}
              autoFocus={isEditing}
              style={{ fontSize: object.fontSize, fontFamily: object.fontFamily, color: object.textColor, background: object.fill === "transparent" ? "transparent" : object.fill, pointerEvents: isEditing ? "auto" : "none", cursor: isEditing ? "text" : "move" }}
              onPointerDown={(event) => {
                if (!isEditing) {
                  return;
                }

                event.stopPropagation();
                onSelect(object.id);
              }}
              onChange={(event) => updateObject(object.id, { ...object, text: event.target.value })}
              onBlur={() => {
                if (editingLabelId === object.id) {
                  setEditingLabelId(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.currentTarget.blur();
                }
              }}
            />
            {isSelected ? <TransformHandles width={object.width} height={object.height} rotation={0} onRotateStart={(event) => startRotate(event, object)} showResize={false} /> : null}
          </div>
        );
      })}

      {imageObjects.map((object) => {
        const isSelected = object.id === selectedId;
        return (
          <div
            key={object.id}
            className={`image-object${isSelected ? " selected" : ""}`}
            style={{ left: object.x, top: object.y, width: object.width, height: object.height, transform: `rotate(${object.rotation}deg)`, transformOrigin: "center center", pointerEvents: "auto" }}
            onPointerDown={(event) => startDrag(event, object)}
          >
            <img src={toAssetUrl(object.src)} alt={object.fileName} draggable={false} className="image-object-frame" />
            {isSelected ? <TransformHandles width={object.width} height={object.height} rotation={0} onResizeStart={(event, handle) => startResizeObject(event, object, handle)} onRotateStart={(event) => startRotate(event, object)} showResize /> : null}
          </div>
        );
      })}

      {fileObjects.map((object) => {
        const isSelected = object.id === selectedId;
        const Icon = getFileIcon(object.mimeType);

        return (
          <div
            key={object.id}
            className={`file-object${isSelected ? " selected" : ""}`}
            style={{ left: object.x, top: object.y, width: object.width, height: object.height, transform: `rotate(${object.rotation}deg)`, transformOrigin: "center center", pointerEvents: "auto" }}
            onPointerDown={(event) => startDrag(event, object)}
          >
            <div className="file-object-card">
              <div className="file-object-icon"><Icon /></div>
              <div className="file-object-copy">
                <strong>{object.fileName}</strong>
                <span>{object.fileSize}</span>
              </div>
              <button
                type="button"
                className="file-object-open"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={() => {
                  void window.notesApi.assets.open(object.path);
                }}
              >
                Open
              </button>
            </div>
            {isSelected ? <TransformHandles width={object.width} height={object.height} rotation={0} onResizeStart={(event, handle) => startResizeObject(event, object, handle)} onRotateStart={(event) => startRotate(event, object)} showResize /> : null}
          </div>
        );
      })}
    </div>
  );
}
