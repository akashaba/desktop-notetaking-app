import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type Point = {
  x: number;
  y: number;
};

type Stroke = {
  points: Point[];
};

type SketchCanvasProps = {
  value?: string | null;
  onChange: (value: string | null) => void;
  readOnly?: boolean;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
};

export type SketchCanvasHandle = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
};

function parseDrawingData(value?: string | null) {
  if (!value) {
    return [] as Stroke[];
  }

  try {
    const parsedValue = JSON.parse(value) as Stroke[];

    if (!Array.isArray(parsedValue)) {
      return [] as Stroke[];
    }

    return parsedValue.filter(
      (stroke) => Array.isArray(stroke.points) && stroke.points.every((point) => typeof point.x === "number" && typeof point.y === "number")
    );
  } catch {
    return [] as Stroke[];
  }
}

function serializeDrawingData(strokes: Stroke[]) {
  return strokes.length > 0 ? JSON.stringify(strokes) : null;
}

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number
) {
  if (stroke.points.length === 0) {
    return;
  }

  context.beginPath();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#17305d";
  context.lineWidth = 3;

  const [firstPoint, ...remainingPoints] = stroke.points;
  context.moveTo(firstPoint.x * width, firstPoint.y * height);

  if (remainingPoints.length === 0) {
    context.lineTo(firstPoint.x * width + 0.1, firstPoint.y * height + 0.1);
  }

  for (const point of remainingPoints) {
    context.lineTo(point.x * width, point.y * height);
  }

  context.stroke();
}

export const SketchCanvas = forwardRef<SketchCanvasHandle, SketchCanvasProps>(function SketchCanvas(
  { value, onChange, readOnly = false, onHistoryChange },
  ref
) {
  const parsedValue = useMemo(() => parseDrawingData(value), [value]);
  const [strokes, setStrokes] = useState<Stroke[]>(parsedValue);
  const [draftStroke, setDraftStroke] = useState<Point[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const strokesRef = useRef<Stroke[]>(parsedValue);
  const serializedStrokesRef = useRef(serializeDrawingData(parsedValue));
  const pointerIdRef = useRef<number | null>(null);
  const undoStackRef = useRef<(string | null)[]>([]);
  const redoStackRef = useRef<(string | null)[]>([]);

  useEffect(() => {
    const nextSerializedValue = serializeDrawingData(parsedValue);

    if (nextSerializedValue !== serializedStrokesRef.current) {
      serializedStrokesRef.current = nextSerializedValue;
      strokesRef.current = parsedValue;
      setStrokes(parsedValue);
      setDraftStroke([]);
      undoStackRef.current = [];
      redoStackRef.current = [];
    }
  }, [parsedValue]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    onHistoryChange?.({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  }, [onHistoryChange, strokes]);

  const applySerializedValue = (serializedValue: string | null) => {
    serializedStrokesRef.current = serializedValue;
    const nextStrokes = parseDrawingData(serializedValue);
    strokesRef.current = nextStrokes;
    setStrokes(nextStrokes);
    setDraftStroke([]);
    onChange(serializedValue);
    onHistoryChange?.({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  };

  useImperativeHandle(ref, () => ({
    undo: () => {
      const previousValue = undoStackRef.current.pop();

      if (previousValue === undefined) {
        return;
      }

      redoStackRef.current.push(serializedStrokesRef.current ?? null);
      applySerializedValue(previousValue);
    },
    redo: () => {
      const nextValue = redoStackRef.current.pop();

      if (nextValue === undefined) {
        return;
      }

      undoStackRef.current.push(serializedStrokesRef.current ?? null);
      applySerializedValue(nextValue);
    },
    clear: () => {
      if (!serializedStrokesRef.current) {
        return;
      }

      undoStackRef.current.push(serializedStrokesRef.current);
      redoStackRef.current = [];
      applySerializedValue(null);
    },
  }));

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) {
      return;
    }

    const updateCanvasSize = () => {
      if (!containerRef.current || !canvasRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const nextWidth = Math.max(Math.floor(rect.width), 1);
      const nextHeight = Math.max(Math.floor(rect.height), 1);
      const devicePixelRatio = window.devicePixelRatio || 1;

      canvasRef.current.width = Math.floor(nextWidth * devicePixelRatio);
      canvasRef.current.height = Math.floor(nextHeight * devicePixelRatio);
      canvasRef.current.style.width = `${nextWidth}px`;
      canvasRef.current.style.height = `${nextHeight}px`;

      const context = canvasRef.current.getContext("2d");

      if (!context) {
        return;
      }

      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.clearRect(0, 0, nextWidth, nextHeight);

      for (const stroke of strokes) {
        drawStroke(context, stroke, nextWidth, nextHeight);
      }

      if (draftStroke.length > 0) {
        drawStroke(context, { points: draftStroke }, nextWidth, nextHeight);
      }
    };

    updateCanvasSize();

    const resizeObserver = new ResizeObserver(() => updateCanvasSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [draftStroke, strokes]);

  const getRelativePoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();

    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  };

  const commitStroke = (points: Point[]) => {
    if (points.length === 0) {
      return;
    }

    const nextStrokes = [...strokesRef.current, { points }];
    const serializedValue = serializeDrawingData(nextStrokes);

    strokesRef.current = nextStrokes;
    undoStackRef.current.push(serializedStrokesRef.current ?? null);
    redoStackRef.current = [];
    serializedStrokesRef.current = serializedValue;
    setStrokes(nextStrokes);
    onChange(serializedValue);
    onHistoryChange?.({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  };

  return (
    <div ref={containerRef} className={readOnly ? "sketch-canvas read-only" : "sketch-canvas"}>
      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          if (readOnly) {
            return;
          }

          const nextPoint = getRelativePoint(event);

          pointerIdRef.current = event.pointerId;

          if (typeof event.currentTarget.setPointerCapture === "function") {
            event.currentTarget.setPointerCapture(event.pointerId);
          }

          setDraftStroke([nextPoint]);
        }}
        onPointerMove={(event) => {
          if (readOnly || pointerIdRef.current !== event.pointerId || draftStroke.length === 0) {
            return;
          }

          const nextPoint = getRelativePoint(event);

          setDraftStroke((current) => [...current, nextPoint]);
        }}
        onPointerUp={(event) => {
          if (readOnly || pointerIdRef.current !== event.pointerId) {
            return;
          }

          const nextPoint = getRelativePoint(event);

          if (
            typeof event.currentTarget.hasPointerCapture === "function" &&
            event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }

          pointerIdRef.current = null;
          const completedStroke = draftStroke.length > 0 ? [...draftStroke, nextPoint] : [];
          setDraftStroke([]);
          commitStroke(completedStroke);
        }}
        onPointerCancel={(event) => {
          if (pointerIdRef.current !== event.pointerId) {
            return;
          }

          if (
            typeof event.currentTarget.hasPointerCapture === "function" &&
            event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }

          pointerIdRef.current = null;
          setDraftStroke([]);
        }}
        onPointerLeave={(event) => {
          if (readOnly || pointerIdRef.current !== event.pointerId || draftStroke.length === 0) {
            return;
          }

          if (event.buttons === 1) {
            return;
          }

          pointerIdRef.current = null;
          setDraftStroke([]);
        }}
      />
    </div>
  );
});