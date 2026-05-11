import type { Descendant } from "slate";

export type FormattedText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: boolean;
};

export type ParagraphElement = {
  type: "paragraph";
  children: FormattedText[];
};

export type ListItemElement = {
  type: "list-item";
  children: FormattedText[];
};

export type BulletedListElement = {
  type: "bulleted-list";
  children: ListItemElement[];
};

export type NumberedListElement = {
  type: "numbered-list";
  children: ListItemElement[];
};

export type DrawingBlockElement = {
  type: "drawing-block";
  id: string;
  drawingData?: string | null;
  width?: number;
  height?: number;
  children: FormattedText[];
};

export type RichElement =
  | ParagraphElement
  | ListItemElement
  | BulletedListElement
  | NumberedListElement
  | DrawingBlockElement;

export type NoteAttachment = {
  id: string;
  name: string;
  kind: "image" | "file";
  mimeType: string;
  dataUrl: string;
  size: number;
  createdAt: string;
};

export type NoteAttachmentThumbnail = {
  id: string;
  kind: "image" | "file";
  thumbnailDataUrl?: string | null;
};

const EMPTY_DOCUMENT: Descendant[] = [
  {
    type: "paragraph",
    children: [{ text: "" }],
  },
];

function stripMarkup(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isRichTextNode(value: unknown): value is Descendant[] {
  return (
    Array.isArray(value) &&
    value.every(
      (node) =>
        typeof node === "object" &&
        node !== null &&
        "children" in node &&
        Array.isArray((node as { children: unknown[] }).children)
    )
  );
}

export function deserializeNoteContent(value: string): Descendant[] {
  if (!value.trim()) {
    return EMPTY_DOCUMENT;
  }

  try {
    const parsedValue = JSON.parse(value) as unknown;

    if (isRichTextNode(parsedValue)) {
      return parsedValue;
    }
  } catch {
    // Fall through to legacy text/html migration.
  }

  const plainText = stripMarkup(value);

  if (!plainText) {
    return EMPTY_DOCUMENT;
  }

  return plainText.split(/\n{2,}/).map((paragraph) => ({
    type: "paragraph",
    children: [{ text: paragraph }],
  }));
}

export function serializeNoteContent(value: Descendant[]) {
  return JSON.stringify(value);
}

export function extractPlainTextFromContent(value: string) {
  const nodes = deserializeNoteContent(value);
  const parts: string[] = [];

  const visit = (node: Descendant) => {
    if ("text" in node) {
      parts.push(node.text);
      return;
    }

    if (node.type === "numbered-list" || node.type === "bulleted-list") {
      for (const child of node.children) {
        visit(child);
        parts.push("\n");
      }
      return;
    }

    if (node.type === "drawing-block") {
      parts.push("[Sketch]\n");
      return;
    }

    for (const child of node.children) {
      visit(child);
    }

    parts.push("\n");
  };

  for (const node of nodes) {
    visit(node);
  }

  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export function parseAttachmentsData(value?: string | null) {
  if (!value) {
    return [] as NoteAttachment[];
  }

  try {
    const parsedValue = JSON.parse(value) as NoteAttachment[];

    if (!Array.isArray(parsedValue)) {
      return [] as NoteAttachment[];
    }

    return parsedValue.filter(
      (attachment) =>
        typeof attachment?.id === "string" &&
        typeof attachment?.name === "string" &&
        (attachment?.kind === "image" || attachment?.kind === "file") &&
        typeof attachment?.dataUrl === "string"
    );
  } catch {
    return [] as NoteAttachment[];
  }
}

export function stringifyAttachmentsData(value: NoteAttachment[]) {
  return value.length > 0 ? JSON.stringify(value) : null;
}

export function parseAttachmentThumbnailsData(value?: string | null) {
  if (!value) {
    return [] as NoteAttachmentThumbnail[];
  }

  try {
    const parsedValue = JSON.parse(value) as NoteAttachmentThumbnail[];

    if (!Array.isArray(parsedValue)) {
      return [] as NoteAttachmentThumbnail[];
    }

    return parsedValue.filter(
      (thumbnail) =>
        typeof thumbnail?.id === "string" &&
        (thumbnail?.kind === "image" || thumbnail?.kind === "file")
    );
  } catch {
    return [] as NoteAttachmentThumbnail[];
  }
}

export function stringifyAttachmentThumbnailsData(value: NoteAttachmentThumbnail[]) {
  return value.length > 0 ? JSON.stringify(value) : null;
}

// --- Unified note objects (shapes, labels, images) ---

export type ObjectPoint = {
  x: number;
  y: number;
};

export type ShapeType =
  | "rect"
  | "roundedRect"
  | "circle"
  | "oval"
  | "triangle"
  | "diamond"
  | "line"
  | "arrow"
  | "doubleArrow"
  | "cloud"
  | "callout"
  | "bracket"
  | "cylinder"
  | "stickyNote"
  | "star"
  | "path";

type BaseCanvasObject = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
  strokeDasharray?: string;
};

export type ShapeObject = BaseCanvasObject & {
  type: Exclude<ShapeType, "path">;
};

export type PathObject = BaseCanvasObject & {
  type: "path";
  points: ObjectPoint[];
};

export type LabelObject = BaseCanvasObject & {
  type: "label";
  text: string;
  fontSize: number;
  fontFamily: string;
  textColor: string;
};

export type ImageObject = BaseCanvasObject & {
  type: "image";
  src: string;
  fileName: string;
  mimeType: string;
};

export type FileObject = BaseCanvasObject & {
  type: "file";
  fileName: string;
  fileSize: string;
  mimeType: string;
  path: string;
};

export type DrawingShape = ShapeObject | PathObject;

export type NoteObject = DrawingShape | LabelObject | ImageObject | FileObject;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampSize(value: number, fallback = 20) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(20, Math.abs(Math.round(value)));
}

function clampNumber(value: number, fallback: number, minimum: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.abs(Math.round(value)));
}

function normalizeSignedDimension(value: unknown, fallback: number) {
  if (!isFiniteNumber(value)) {
    return fallback;
  }

  if (value === 0) {
    return fallback;
  }

  const magnitude = Math.max(1, Math.abs(Math.round(value)));
  return Math.sign(value) * magnitude;
}

function normalizePoint(point: unknown): ObjectPoint | null {
  if (
    typeof point !== "object" ||
    point === null ||
    !isFiniteNumber((point as { x?: unknown }).x) ||
    !isFiniteNumber((point as { y?: unknown }).y)
  ) {
    return null;
  }

  return {
    x: Math.round((point as { x: number }).x),
    y: Math.round((point as { y: number }).y),
  };
}

function getPointsBounds(points: ObjectPoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(20, maxX - minX),
    height: Math.max(20, maxY - minY),
  };
}

function normalizeBaseObject(object: Record<string, unknown>) {
  const x = isFiniteNumber(object.x) ? object.x : 0;
  const y = isFiniteNumber(object.y) ? object.y : 0;
  const type = object.type;
  const preserveSignedSize =
    type === "line" || type === "arrow" || type === "doubleArrow";
  return {
    id: typeof object.id === "string" ? object.id : crypto.randomUUID(),
    x: Math.round(x),
    y: Math.round(y),
    width: preserveSignedSize
      ? normalizeSignedDimension(object.width, 120)
      : clampSize(isFiniteNumber(object.width) ? object.width : 120, 120),
    height: preserveSignedSize
      ? normalizeSignedDimension(object.height, 80)
      : clampSize(isFiniteNumber(object.height) ? object.height : 80, 80),
    rotation: isFiniteNumber(object.rotation) ? object.rotation : 0,
    stroke: typeof object.stroke === "string" ? object.stroke : "#1e293b",
    fill: typeof object.fill === "string" ? object.fill : "transparent",
    strokeWidth: clampNumber(isFiniteNumber(object.strokeWidth) ? object.strokeWidth : 2, 2, 1),
    strokeDasharray:
      typeof object.strokeDasharray === "string" ? object.strokeDasharray : undefined,
  };
}

function migrateObject(rawObject: unknown): NoteObject | null {
  if (typeof rawObject !== "object" || rawObject === null) {
    return null;
  }

  const object = rawObject as Record<string, unknown>;
  const type = object.type;

  if (type === "path") {
    const points = Array.isArray(object.points)
      ? object.points.map(normalizePoint).filter((point): point is ObjectPoint => point !== null)
      : [];

    if (points.length < 2) {
      return null;
    }

    const bounds = getPointsBounds(points);
    return {
      ...normalizeBaseObject({ ...object, ...bounds }),
      type: "path",
      points,
      fill: "transparent",
    };
  }

  if (type === "rectangle") {
    return {
      ...normalizeBaseObject({
        ...object,
        type: "rect",
        fill: "transparent",
      }),
      type: "rect",
    };
  }

  if (type === "circle") {
    const cx = isFiniteNumber(object.cx) ? object.cx : 0;
    const cy = isFiniteNumber(object.cy) ? object.cy : 0;
    const r = clampSize(isFiniteNumber(object.r) ? object.r * 2 : 80, 80) / 2;
    return {
      ...normalizeBaseObject({
        ...object,
        x: cx - r,
        y: cy - r,
        width: r * 2,
        height: r * 2,
        fill: "transparent",
      }),
      type: "circle",
    };
  }

  if (type === "arrow" && isFiniteNumber(object.startX) && isFiniteNumber(object.endX)) {
    return {
      ...normalizeBaseObject({
        ...object,
        x: object.startX,
        y: isFiniteNumber(object.startY) ? object.startY : 0,
        width: object.endX - object.startX,
        height:
          (isFiniteNumber(object.endY) ? object.endY : 0) -
          (isFiniteNumber(object.startY) ? object.startY : 0),
        fill: "transparent",
      }),
      type: "arrow",
    };
  }

  if (type === "text") {
    const text = typeof object.text === "string" ? object.text : "";
    const fontSize = clampSize(isFiniteNumber(object.fontSize) ? object.fontSize : 22, 22);
    const lineCount = Math.max(1, text.split("\n").length);
    return {
      ...normalizeBaseObject({
        ...object,
        width: Math.max(160, text.length * Math.max(8, fontSize * 0.55)),
        height: Math.max(60, lineCount * (fontSize + 10)),
        stroke: "transparent",
        fill: "transparent",
      }),
      type: "label",
      text,
      fontSize: clampNumber(fontSize, 22, 12),
      fontFamily:
        typeof object.fontFamily === "string" ? object.fontFamily : "Caveat, cursive",
      textColor: typeof object.fill === "string" ? object.fill : "#111827",
    };
  }

  if (type === "image") {
    if (
      typeof object.src !== "string" ||
      typeof object.fileName !== "string" ||
      typeof object.mimeType !== "string"
    ) {
      return null;
    }

    return {
      ...normalizeBaseObject({
        ...object,
        stroke: typeof object.stroke === "string" ? object.stroke : "transparent",
        fill: typeof object.fill === "string" ? object.fill : "transparent",
      }),
      type: "image",
      src: object.src,
      fileName: object.fileName,
      mimeType: object.mimeType,
    };
  }

  if (type === "file") {
    if (
      typeof object.fileName !== "string" ||
      typeof object.fileSize !== "string" ||
      typeof object.mimeType !== "string" ||
      typeof object.path !== "string"
    ) {
      return null;
    }

    return {
      ...normalizeBaseObject({
        ...object,
        width: isFiniteNumber(object.width) ? object.width : 260,
        height: isFiniteNumber(object.height) ? object.height : 76,
        stroke: typeof object.stroke === "string" ? object.stroke : "#dbe3ef",
        fill: typeof object.fill === "string" ? object.fill : "#ffffff",
      }),
      type: "file",
      fileName: object.fileName,
      fileSize: object.fileSize,
      mimeType: object.mimeType,
      path: object.path,
    };
  }

  if (type === "label") {
    return {
      ...normalizeBaseObject({
        ...object,
        stroke: typeof object.stroke === "string" ? object.stroke : "transparent",
      }),
      type: "label",
      text: typeof object.text === "string" ? object.text : "",
      fontSize: clampNumber(isFiniteNumber(object.fontSize) ? object.fontSize : 22, 22, 12),
      fontFamily:
        typeof object.fontFamily === "string" ? object.fontFamily : "Caveat, cursive",
      textColor:
        typeof object.textColor === "string"
          ? object.textColor
          : typeof object.fill === "string"
            ? object.fill
            : "#111827",
    };
  }

  if (
    type === "rect" ||
    type === "roundedRect" ||
    type === "circle" ||
    type === "oval" ||
    type === "triangle" ||
    type === "diamond" ||
    type === "line" ||
    type === "arrow" ||
    type === "doubleArrow" ||
    type === "cloud" ||
    type === "callout" ||
    type === "bracket" ||
    type === "cylinder" ||
    type === "stickyNote" ||
    type === "star"
  ) {
    return {
      ...normalizeBaseObject(object),
      type,
    } as ShapeObject;
  }

  return null;
}

export function parseObjectsData(value: string | null | undefined): NoteObject[] {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value) as unknown;

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map(migrateObject)
      .filter((object): object is NoteObject => object !== null);
  } catch {
    return [];
  }
}

export function stringifyObjectsData(objects: NoteObject[]): string {
  return JSON.stringify(objects);
}

export function isShapeObject(object: NoteObject): object is DrawingShape {
  return object.type !== "label" && object.type !== "image" && object.type !== "file";
}

export function isLabelObject(object: NoteObject): object is LabelObject {
  return object.type === "label";
}

export function isImageObject(object: NoteObject): object is ImageObject {
  return object.type === "image";
}

export function isFileObject(object: NoteObject): object is FileObject {
  return object.type === "file";
}

export const parseDrawingsData = parseObjectsData;
export const stringifyDrawingsData = (shapes: DrawingShape[]): string =>
  JSON.stringify(shapes);
