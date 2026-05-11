import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DrawingShape, NoteObject, ObjectPoint, ShapeObject } from "./noteModel";
import { isShapeObject } from "./noteModel";

export type ShapeTool =
  | "rect"
  | "roundedRect"
  | "circle"
  | "oval"
  | "triangle"
  | "diamond"
  | "line"
  | "dashedLine"
  | "doubleArrow"
  | "cloud"
  | "callout"
  | "bracket"
  | "cylinder"
  | "stickyNote"
  | "star";

export type DrawTool = "view" | "select" | "freehand" | "arrow" | "label" | ShapeTool;

type DrawingLayerProps = {
  objects: NoteObject[];
  onChange: (objects: NoteObject[]) => void;
  activeTool: DrawTool;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  drawColor?: string;
};

type ResizeHandle = "nw" | "ne" | "sw" | "se" | "start" | "end";

const STROKE = "#1e293b";
const STROKE_W = 2;
const SEL_COLOR = "#2563eb";
const MIN_SIZE = 20;

function pathFromPoints(points: ObjectPoint[]) {
  if (points.length === 0) {
    return "";
  }

  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(" ")}`;
}

function getShapeBounds(shape: DrawingShape) {
  if (shape.type === "path") {
    const xs = shape.points.map((point) => point.x);
    const ys = shape.points.map((point) => point.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(MIN_SIZE, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(MIN_SIZE, Math.max(...ys) - Math.min(...ys)),
    };
  }

  return {
    x: shape.x,
    y: shape.y,
    width: Math.max(MIN_SIZE, Math.abs(shape.width)),
    height: Math.max(MIN_SIZE, Math.abs(shape.height)),
  };
}

function getShapeCenter(shape: DrawingShape) {
  const bounds = getShapeBounds(shape);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function isLineLikeShape(shape: DrawingShape) {
  return shape.type === "line" || shape.type === "arrow" || shape.type === "doubleArrow";
}

function normalizeBox(left: number, top: number, right: number, bottom: number, keepSquare: boolean) {
  let nextLeft = left;
  let nextTop = top;
  let nextRight = right;
  let nextBottom = bottom;

  if (keepSquare) {
    const width = nextRight - nextLeft;
    const height = nextBottom - nextTop;
    const size = Math.max(MIN_SIZE, Math.max(Math.abs(width), Math.abs(height)));
    nextRight = width >= 0 ? nextLeft + size : nextLeft - size;
    nextBottom = height >= 0 ? nextTop + size : nextTop - size;
  }

  return {
    x: Math.round(Math.min(nextLeft, nextRight)),
    y: Math.round(Math.min(nextTop, nextBottom)),
    width: Math.round(Math.max(MIN_SIZE, Math.abs(nextRight - nextLeft))),
    height: Math.round(Math.max(MIN_SIZE, Math.abs(nextBottom - nextTop))),
  };
}

function translateShape(shape: DrawingShape, dx: number, dy: number): DrawingShape {
  if (shape.type === "path") {
    return {
      ...shape,
      x: shape.x + dx,
      y: shape.y + dy,
      points: shape.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    };
  }

  return {
    ...shape,
    x: shape.x + dx,
    y: shape.y + dy,
  };
}

function resizePathShape(shape: DrawingShape, nextBounds: { x: number; y: number; width: number; height: number }) {
  if (shape.type !== "path") {
    return shape;
  }

  const source = getShapeBounds(shape);
  const scaleX = source.width === 0 ? 1 : nextBounds.width / source.width;
  const scaleY = source.height === 0 ? 1 : nextBounds.height / source.height;

  return {
    ...shape,
    ...nextBounds,
    points: shape.points.map((point) => ({
      x: Math.round(nextBounds.x + (point.x - source.x) * scaleX),
      y: Math.round(nextBounds.y + (point.y - source.y) * scaleY),
    })),
  };
}

function getProportionalPathBounds(shape: DrawingShape, handle: Exclude<ResizeHandle, "start" | "end">, dx: number, dy: number) {
  const bounds = getShapeBounds(shape);
  const aspectRatio = bounds.width / Math.max(1, bounds.height);

  if (handle === "nw") {
    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    const rawWidth = Math.max(MIN_SIZE, right - (bounds.x + dx));
    const rawHeight = Math.max(MIN_SIZE, bottom - (bounds.y + dy));
    const nextWidth = rawWidth / Math.max(1, rawHeight) > aspectRatio ? rawWidth : Math.round(rawHeight * aspectRatio);
    const nextHeight = Math.round(nextWidth / Math.max(0.0001, aspectRatio));
    return {
      x: Math.round(right - nextWidth),
      y: Math.round(bottom - nextHeight),
      width: Math.round(nextWidth),
      height: Math.round(nextHeight),
    };
  }

  if (handle === "ne") {
    const left = bounds.x;
    const bottom = bounds.y + bounds.height;
    const rawWidth = Math.max(MIN_SIZE, bounds.width + dx);
    const rawHeight = Math.max(MIN_SIZE, bottom - (bounds.y + dy));
    const nextWidth = rawWidth / Math.max(1, rawHeight) > aspectRatio ? rawWidth : Math.round(rawHeight * aspectRatio);
    const nextHeight = Math.round(nextWidth / Math.max(0.0001, aspectRatio));
    return {
      x: Math.round(left),
      y: Math.round(bottom - nextHeight),
      width: Math.round(nextWidth),
      height: Math.round(nextHeight),
    };
  }

  if (handle === "sw") {
    const right = bounds.x + bounds.width;
    const top = bounds.y;
    const rawWidth = Math.max(MIN_SIZE, right - (bounds.x + dx));
    const rawHeight = Math.max(MIN_SIZE, bounds.height + dy);
    const nextWidth = rawWidth / Math.max(1, rawHeight) > aspectRatio ? rawWidth : Math.round(rawHeight * aspectRatio);
    const nextHeight = Math.round(nextWidth / Math.max(0.0001, aspectRatio));
    return {
      x: Math.round(right - nextWidth),
      y: Math.round(top),
      width: Math.round(nextWidth),
      height: Math.round(nextHeight),
    };
  }

  const left = bounds.x;
  const top = bounds.y;
  const rawWidth = Math.max(MIN_SIZE, bounds.width + dx);
  const rawHeight = Math.max(MIN_SIZE, bounds.height + dy);
  const nextWidth = rawWidth / Math.max(1, rawHeight) > aspectRatio ? rawWidth : Math.round(rawHeight * aspectRatio);
  const nextHeight = Math.round(nextWidth / Math.max(0.0001, aspectRatio));
  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(nextWidth),
    height: Math.round(nextHeight),
  };
}

function resizeShape(shape: DrawingShape, handle: ResizeHandle, dx: number, dy: number): DrawingShape {
  if (isLineLikeShape(shape)) {
    if (handle === "start") {
      const endX = shape.x + shape.width;
      const endY = shape.y + shape.height;
      return {
        ...shape,
        x: Math.round(shape.x + dx),
        y: Math.round(shape.y + dy),
        width: Math.round(endX - (shape.x + dx)),
        height: Math.round(endY - (shape.y + dy)),
      };
    }

    return {
      ...shape,
      width: Math.round(shape.width + dx),
      height: Math.round(shape.height + dy),
    };
  }

  const bounds = getShapeBounds(shape);
  let left = bounds.x;
  let top = bounds.y;
  let right = bounds.x + bounds.width;
  let bottom = bounds.y + bounds.height;

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

  if (shape.type === "path") {
    return resizePathShape(shape, getProportionalPathBounds(shape, handle, dx, dy));
  }

  const nextBounds = normalizeBox(left, top, right, bottom, shape.type === "circle");

  return {
    ...shape,
    ...nextBounds,
  };
}

function getAngle(center: ObjectPoint, point: ObjectPoint) {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

function buildRegularPolygonPoints(shape: ShapeObject) {
  if (shape.type === "triangle") {
    return `${shape.x + shape.width / 2},${shape.y} ${shape.x + shape.width},${shape.y + shape.height} ${shape.x},${shape.y + shape.height}`;
  }

  return `${shape.x + shape.width / 2},${shape.y} ${shape.x + shape.width},${shape.y + shape.height / 2} ${shape.x + shape.width / 2},${shape.y + shape.height} ${shape.x},${shape.y + shape.height / 2}`;
}

function buildCloudPath(shape: ShapeObject) {
  const { x, y, width, height } = shape;
  const right = x + width;
  const bottom = y + height;
  const waveX = width / 5;
  const waveY = height / 4;
  return [
    `M ${x + waveX} ${bottom}`,
    `Q ${x - waveX / 2} ${bottom - waveY} ${x + waveX / 3} ${y + height / 2}`,
    `Q ${x} ${y + waveY / 3} ${x + waveX * 1.7} ${y + waveY}`,
    `Q ${x + width / 2} ${y - waveY} ${x + width * 0.72} ${y + waveY}`,
    `Q ${right + waveX / 3} ${y + waveY} ${right - waveX / 4} ${y + height / 2}`,
    `Q ${right + waveX / 2} ${bottom - waveY / 2} ${right - waveX} ${bottom}`,
    "Z",
  ].join(" ");
}

function buildCalloutPath(shape: ShapeObject) {
  const { x, y, width, height } = shape;
  const radius = Math.min(18, width / 8, height / 8);
  const tailX = x + width * 0.28;
  return [
    `M ${x + radius} ${y}`,
    `H ${x + width - radius}`,
    `Q ${x + width} ${y} ${x + width} ${y + radius}`,
    `V ${y + height - radius * 1.6}`,
    `Q ${x + width} ${y + height} ${x + width - radius} ${y + height}`,
    `H ${tailX + 18}`,
    `L ${tailX} ${y + height + 18}`,
    `L ${tailX + 8} ${y + height}`,
    `H ${x + radius}`,
    `Q ${x} ${y + height} ${x} ${y + height - radius}`,
    `V ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    "Z",
  ].join(" ");
}

function buildBracketPath(shape: ShapeObject) {
  const inset = Math.max(16, shape.width * 0.2);
  return `M ${shape.x + shape.width} ${shape.y} H ${shape.x + inset} V ${shape.y + shape.height} H ${shape.x + shape.width}`;
}

function buildCylinderBody(shape: ShapeObject) {
  const ellipseHeight = Math.max(10, shape.height / 6);
  return [
    `M ${shape.x} ${shape.y + ellipseHeight}`,
    `C ${shape.x} ${shape.y - ellipseHeight / 4} ${shape.x + shape.width} ${shape.y - ellipseHeight / 4} ${shape.x + shape.width} ${shape.y + ellipseHeight}`,
    `V ${shape.y + shape.height - ellipseHeight}`,
    `C ${shape.x + shape.width} ${shape.y + shape.height + ellipseHeight / 4} ${shape.x} ${shape.y + shape.height + ellipseHeight / 4} ${shape.x} ${shape.y + shape.height - ellipseHeight}`,
    "Z",
  ].join(" ");
}

function buildStickyFold(shape: ShapeObject) {
  const fold = Math.min(26, shape.width / 3.5);
  return `${shape.x + shape.width - fold},${shape.y} ${shape.x + shape.width},${shape.y + fold} ${shape.x + shape.width - fold},${shape.y + fold}`;
}

function buildStarPath(shape: ShapeObject) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const outer = Math.min(shape.width, shape.height) / 2;
  const inner = outer * 0.45;
  const points: string[] = [];

  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? outer : inner;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }

  return `M ${points[0]} L ${points.slice(1).join(" L ")} Z`;
}

function renderShapeGeometry(shape: DrawingShape) {
  const commonProps = {
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    fill: shape.fill === "transparent" ? "none" : shape.fill,
    strokeDasharray: shape.strokeDasharray,
  };

  if (shape.type === "path") {
    return <path d={pathFromPoints(shape.points)} stroke={shape.stroke} strokeWidth={shape.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  }

  if (shape.type === "rect") {
    return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={4} {...commonProps} />;
  }

  if (shape.type === "roundedRect") {
    return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={20} {...commonProps} />;
  }

  if (shape.type === "circle" || shape.type === "oval") {
    return <ellipse cx={shape.x + shape.width / 2} cy={shape.y + shape.height / 2} rx={shape.width / 2} ry={shape.height / 2} {...commonProps} />;
  }

  if (shape.type === "triangle" || shape.type === "diamond") {
    return <polygon points={buildRegularPolygonPoints(shape)} {...commonProps} />;
  }

  if (shape.type === "line" || shape.type === "arrow" || shape.type === "doubleArrow") {
    return (
      <line
        x1={shape.x}
        y1={shape.y}
        x2={shape.x + shape.width}
        y2={shape.y + shape.height}
        stroke={shape.stroke}
        strokeWidth={shape.strokeWidth}
        strokeDasharray={shape.strokeDasharray}
        markerStart={shape.type === "doubleArrow" ? "url(#dl-arrowhead)" : undefined}
        markerEnd={shape.type === "arrow" || shape.type === "doubleArrow" ? "url(#dl-arrowhead)" : undefined}
      />
    );
  }

  if (shape.type === "cloud") {
    return <path d={buildCloudPath(shape)} {...commonProps} />;
  }

  if (shape.type === "callout") {
    return <path d={buildCalloutPath(shape)} {...commonProps} />;
  }

  if (shape.type === "bracket") {
    return <path d={buildBracketPath(shape)} strokeLinecap="round" fill="none" {...commonProps} />;
  }

  if (shape.type === "cylinder") {
    const ellipseHeight = Math.max(10, shape.height / 6);
    return (
      <>
        <path d={buildCylinderBody(shape)} {...commonProps} />
        <ellipse cx={shape.x + shape.width / 2} cy={shape.y + ellipseHeight} rx={shape.width / 2} ry={ellipseHeight} stroke={shape.stroke} strokeWidth={shape.strokeWidth} fill={shape.fill === "transparent" ? "white" : shape.fill} />
      </>
    );
  }

  if (shape.type === "stickyNote") {
    return (
      <>
        <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={8} {...commonProps} />
        <polygon points={buildStickyFold(shape)} fill={shape.stroke} opacity={0.16} stroke={shape.stroke} strokeWidth={1} />
      </>
    );
  }

  return <path d={buildStarPath(shape)} {...commonProps} />;
}

function ShapeHitTarget({ shape, cursor, onPointerDown }: { shape: DrawingShape; cursor: CSSProperties["cursor"]; onPointerDown: (event: React.PointerEvent) => void; }) {
  const bounds = getShapeBounds(shape);

  if (shape.type === "path") {
    return <path d={pathFromPoints(shape.points)} stroke="transparent" strokeWidth={18} fill="none" pointerEvents="all" style={{ cursor }} onPointerDown={onPointerDown} />;
  }

  if (isLineLikeShape(shape)) {
    return <line x1={shape.x} y1={shape.y} x2={shape.x + shape.width} y2={shape.y + shape.height} stroke="transparent" strokeWidth={18} pointerEvents="all" style={{ cursor }} onPointerDown={onPointerDown} />;
  }

  return <rect x={bounds.x - 8} y={bounds.y - 8} width={bounds.width + 16} height={bounds.height + 16} fill="transparent" stroke="transparent" pointerEvents="all" style={{ cursor }} onPointerDown={onPointerDown} />;
}

function SelectionOverlay({ shape, onResizeStart, onRotateStart }: { shape: DrawingShape; onResizeStart: (event: React.PointerEvent, handle: ResizeHandle) => void; onRotateStart: (event: React.PointerEvent) => void; }) {
  const bounds = getShapeBounds(shape);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return (
    <g transform={`rotate(${shape.rotation} ${centerX} ${centerY})`}>
      <rect x={bounds.x - 4} y={bounds.y - 4} width={bounds.width + 8} height={bounds.height + 8} rx={6} fill="none" stroke={SEL_COLOR} strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />
      <line x1={centerX} y1={bounds.y - 4} x2={centerX} y2={bounds.y - 24} stroke={SEL_COLOR} strokeWidth={1.5} pointerEvents="none" />
      <circle cx={centerX} cy={bounds.y - 28} r={6} fill="white" stroke={SEL_COLOR} strokeWidth={2} style={{ cursor: "grab" }} onPointerDown={onRotateStart} />
      {isLineLikeShape(shape) ? (
        <>
          <circle cx={shape.x} cy={shape.y} r={6} fill="white" stroke={SEL_COLOR} strokeWidth={2} style={{ cursor: "pointer" }} onPointerDown={(event) => onResizeStart(event, "start")} />
          <circle cx={shape.x + shape.width} cy={shape.y + shape.height} r={6} fill="white" stroke={SEL_COLOR} strokeWidth={2} style={{ cursor: "pointer" }} onPointerDown={(event) => onResizeStart(event, "end")} />
        </>
      ) : (
        <>
          {[
            { handle: "nw", x: bounds.x, y: bounds.y },
            { handle: "ne", x: bounds.x + bounds.width, y: bounds.y },
            { handle: "sw", x: bounds.x, y: bounds.y + bounds.height },
            { handle: "se", x: bounds.x + bounds.width, y: bounds.y + bounds.height },
          ].map((handle) => (
            <rect key={handle.handle} x={handle.x - 5} y={handle.y - 5} width={10} height={10} rx={2} fill="white" stroke={SEL_COLOR} strokeWidth={2} style={{ cursor: "pointer" }} onPointerDown={(event) => onResizeStart(event, handle.handle as ResizeHandle)} />
          ))}
        </>
      )}
    </g>
  );
}

function getDraftFill(tool: DrawTool, drawColor: string) {
  if (tool === "stickyNote") {
    return "#fef3c7";
  }

  if (tool === "cloud" || tool === "callout" || tool === "cylinder") {
    return `${drawColor}22`;
  }

  return "transparent";
}

function buildDraftShape(tool: DrawTool, start: ObjectPoint, end: ObjectPoint, drawColor: string): DrawingShape | null {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.max(MIN_SIZE, Math.abs(end.x - start.x));
  const height = Math.max(MIN_SIZE, Math.abs(end.y - start.y));

  if (tool === "freehand") {
    return { id: crypto.randomUUID(), type: "path", x: start.x, y: start.y, width: MIN_SIZE, height: MIN_SIZE, rotation: 0, stroke: drawColor, fill: "transparent", strokeWidth: STROKE_W, points: [start] };
  }

  if (tool === "arrow") {
    return { id: crypto.randomUUID(), type: "arrow", x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y, rotation: 0, stroke: drawColor, fill: "transparent", strokeWidth: STROKE_W };
  }

  if (tool === "rect" || tool === "roundedRect" || tool === "circle" || tool === "oval" || tool === "triangle" || tool === "diamond" || tool === "line" || tool === "dashedLine" || tool === "doubleArrow" || tool === "cloud" || tool === "callout" || tool === "bracket" || tool === "cylinder" || tool === "stickyNote" || tool === "star") {
    const isLineShape = tool === "line" || tool === "dashedLine" || tool === "doubleArrow";
    const normalized = isLineShape ? { x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y } : normalizeBox(left, top, left + width, top + height, tool === "circle");
    return {
      id: crypto.randomUUID(),
      type: tool === "dashedLine" ? "line" : tool,
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      rotation: 0,
      stroke: drawColor,
      fill: getDraftFill(tool, drawColor),
      strokeWidth: STROKE_W,
      strokeDasharray: tool === "dashedLine" ? "8 5" : undefined,
    } as DrawingShape;
  }

  return null;
}

export function DrawingLayer({ objects, onChange, activeTool, selectedId, onSelect, surfaceRef, drawColor }: DrawingLayerProps) {
  const activeStroke = drawColor ?? STROKE;
  const [liveShape, setLiveShape] = useState<DrawingShape | null>(null);
  const isDrawingRef = useRef(false);
  const startRef = useRef<ObjectPoint>({ x: 0, y: 0 });
  const livePointsRef = useRef<ObjectPoint[]>([]);
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

  const svgShapes = useMemo(() => objects.filter(isShapeObject), [objects]);
  const selectedShape = useMemo(() => svgShapes.find((shape) => shape.id === selectedId) ?? null, [selectedId, svgShapes]);
  const isDrawMode = activeTool !== "view" && activeTool !== "select" && activeTool !== "label";
  const isSelectMode = activeTool === "select";

  const getPaperClientPt = useCallback((clientX: number, clientY: number) => {
    const surface = surfaceRef.current;
    if (!surface) {
      return { x: 0, y: 0 };
    }

    const rect = surface.getBoundingClientRect();
    return { x: Math.round(clientX - rect.left), y: Math.round(clientY - rect.top) };
  }, [surfaceRef]);

  const updateShape = useCallback((shapeId: string, nextShape: DrawingShape) => {
    onChange(objectsRef.current.map((object) => (object.id === shapeId ? nextShape : object)));
  }, [onChange]);

  const startDragShape = useCallback((event: React.PointerEvent, shape: DrawingShape) => {
    if (!isSelectMode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onSelect(shape.id);
    const startPoint = getPaperClientPt(event.clientX, event.clientY);
    const snapshot = JSON.parse(JSON.stringify(shape)) as DrawingShape;

    const onMove = (pointerEvent: PointerEvent) => {
      const current = getPaperClientPt(pointerEvent.clientX, pointerEvent.clientY);
      updateShape(shape.id, translateShape(snapshot, current.x - startPoint.x, current.y - startPoint.y));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [getPaperClientPt, isSelectMode, onSelect, updateShape]);

  const startResizeShape = useCallback((event: React.PointerEvent, handle: ResizeHandle, shape: DrawingShape) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(shape.id);
    const startPoint = getPaperClientPt(event.clientX, event.clientY);
    const snapshot = JSON.parse(JSON.stringify(shape)) as DrawingShape;

    const onMove = (pointerEvent: PointerEvent) => {
      const current = getPaperClientPt(pointerEvent.clientX, pointerEvent.clientY);
      updateShape(shape.id, resizeShape(snapshot, handle, current.x - startPoint.x, current.y - startPoint.y));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [getPaperClientPt, onSelect, updateShape]);

  const startRotateShape = useCallback((event: React.PointerEvent, shape: DrawingShape) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(shape.id);
    const center = getShapeCenter(shape);
    const startPoint = getPaperClientPt(event.clientX, event.clientY);
    const startAngle = getAngle(center, startPoint);
    const baseRotation = shape.rotation;

    const onMove = (pointerEvent: PointerEvent) => {
      const current = getPaperClientPt(pointerEvent.clientX, pointerEvent.clientY);
      updateShape(shape.id, { ...shape, rotation: Math.round(baseRotation + getAngle(center, current) - startAngle) });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [getPaperClientPt, onSelect, updateShape]);

  const handleSvgPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current || !liveShape) {
      return;
    }

    const current = getPaperClientPt(event.clientX, event.clientY);
    if (activeTool === "freehand" && liveShape.type === "path") {
      const nextPoints = [...livePointsRef.current, current];
      livePointsRef.current = nextPoints;
      setLiveShape({ ...liveShape, ...getShapeBounds({ ...liveShape, points: nextPoints }), points: nextPoints });
      return;
    }

    const nextShape = buildDraftShape(activeTool, startRef.current, current, activeStroke);
    if (nextShape) {
      setLiveShape({ ...nextShape, id: liveShape.id });
    }
  }, [activeStroke, activeTool, getPaperClientPt, liveShape]);

  const handleSvgPointerUp = useCallback(() => {
    if (!isDrawingRef.current || !liveShape) {
      return;
    }

    isDrawingRef.current = false;
    const bounds = getShapeBounds(liveShape);
    const isValid = liveShape.type === "path" ? liveShape.points.length > 3 : bounds.width >= MIN_SIZE && bounds.height >= MIN_SIZE;
    if (isValid) {
      onChange([...objectsRef.current, liveShape]);
      onSelect(liveShape.id);
    }

    setLiveShape(null);
    livePointsRef.current = [];
  }, [liveShape, onChange, onSelect]);

  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<SVGRectElement>) => {
    if (isSelectMode) {
      onSelect(null);
      return;
    }

    if (!isDrawMode) {
      return;
    }

    event.preventDefault();
    isDrawingRef.current = true;
    const startPoint = getPaperClientPt(event.clientX, event.clientY);
    startRef.current = startPoint;
    onSelect(null);
    const draft = buildDraftShape(activeTool, startPoint, startPoint, activeStroke);
    if (!draft) {
      isDrawingRef.current = false;
      return;
    }

    if (draft.type === "path") {
      livePointsRef.current = [startPoint];
    }

    setLiveShape(draft);
  }, [activeStroke, activeTool, getPaperClientPt, isDrawMode, isSelectMode, onSelect]);

  const svgPointerEvents: CSSProperties["pointerEvents"] = activeTool === "view" || activeTool === "label" ? "none" : "auto";

  return (
    <svg className="drawing-layer" style={{ pointerEvents: svgPointerEvents, cursor: isDrawMode ? "crosshair" : "default" }} onPointerMove={handleSvgPointerMove} onPointerUp={handleSvgPointerUp} onPointerLeave={handleSvgPointerUp}>
      <defs>
        <marker id="dl-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="context-stroke" />
        </marker>
      </defs>

      {(isDrawMode || isSelectMode) && <rect x="0" y="0" width="100%" height="100%" fill="transparent" pointerEvents="all" onPointerDown={handleCanvasPointerDown} />}

      {svgShapes.map((shape) => {
        const center = getShapeCenter(shape);
        return (
          <g key={shape.id} transform={`rotate(${shape.rotation} ${center.x} ${center.y})`}>
            <ShapeHitTarget shape={shape} cursor={isSelectMode ? "move" : "default"} onPointerDown={(event) => startDragShape(event, shape)} />
            {renderShapeGeometry(shape)}
          </g>
        );
      })}

      {liveShape && renderShapeGeometry(liveShape)}

      {selectedShape && isSelectMode && <SelectionOverlay shape={selectedShape} onResizeStart={(event, handle) => startResizeShape(event, handle, selectedShape)} onRotateStart={(event) => startRotateShape(event, selectedShape)} />}
    </svg>
  );
}
