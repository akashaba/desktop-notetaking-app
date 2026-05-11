import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  createEditor,
  Editor,
  Element as SlateElement,
  Path,
  Transforms,
  type BaseEditor,
  type Descendant,
} from "slate";
import {
  Editable,
  ReactEditor,
  Slate,
  useSlateStatic,
  withReact,
  type RenderElementProps,
  type RenderLeafProps,
} from "slate-react";
import { withHistory } from "slate-history";
import type { HistoryEditor } from "slate-history";
import {
  deserializeNoteContent,
  serializeNoteContent,
  type DrawingBlockElement,
  type FormattedText,
  type RichElement,
} from "./noteModel";
import { SketchCanvas, type SketchCanvasHandle } from "./SketchCanvas";

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: RichElement;
    Text: FormattedText;
  }
}

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
};

export type RichTextEditorHandle = {
  focus: () => void;
  toggleMark: (mark: "bold" | "italic" | "underline" | "highlight") => void;
  toggleList: (type: "numbered-list" | "bulleted-list") => void;
  insertSketch: () => void;
};

const DEFAULT_INLINE_SKETCH_WIDTH = 420;
const DEFAULT_INLINE_SKETCH_HEIGHT = 220;

function withDrawingBlocks(editor: Editor) {
  const { isVoid } = editor;

  editor.isVoid = (element) => {
    if (SlateElement.isElement(element) && element.type === "drawing-block") {
      return true;
    }

    return isVoid(element);
  };

  return editor;
}

function insertSketchBlock(editor: Editor) {
  const sketchId = crypto.randomUUID();
  const sketchBlock: DrawingBlockElement = {
    type: "drawing-block",
    id: sketchId,
    drawingData: null,
    width: DEFAULT_INLINE_SKETCH_WIDTH,
    height: DEFAULT_INLINE_SKETCH_HEIGHT,
    children: [{ text: "" }],
  };
  const trailingParagraph: RichElement = {
    type: "paragraph",
    children: [{ text: "" }],
  };

  Transforms.insertNodes(editor, [sketchBlock, trailingParagraph]);

  for (const [node, path] of Editor.nodes(editor, {
    at: [],
    match: (currentNode) =>
      SlateElement.isElement(currentNode) &&
      currentNode.type === "drawing-block" &&
      currentNode.id === sketchId,
  })) {
    if (!SlateElement.isElement(node)) {
      continue;
    }

    const nextPath = Path.next(path);
    Transforms.select(editor, Editor.start(editor, nextPath));
    break;
  }
}

function isHotkey(event: React.KeyboardEvent, key: string) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key;
}

function isMarkActive(editor: Editor, format: "bold" | "italic" | "underline" | "highlight") {
  const marks = Editor.marks(editor);
  return marks ? marks[format] === true : false;
}

function toggleMark(editor: Editor, format: "bold" | "italic" | "underline" | "highlight") {
  if (isMarkActive(editor, format)) {
    Editor.removeMark(editor, format);
    return;
  }

  Editor.addMark(editor, format, true);
}

function isBlockActive(editor: Editor, format: "numbered-list" | "bulleted-list") {
  const [match] = Editor.nodes(editor, {
    match: (node) => !Editor.isEditor(node) && SlateElement.isElement(node) && node.type === format,
  });

  return Boolean(match);
}

function toggleList(editor: Editor, format: "numbered-list" | "bulleted-list") {
  const isActive = isBlockActive(editor, format);

  Transforms.unwrapNodes(editor, {
    match: (node) =>
      !Editor.isEditor(node) &&
      SlateElement.isElement(node) &&
      (node.type === "numbered-list" || node.type === "bulleted-list"),
    split: true,
  });

  const nextType = isActive ? "paragraph" : "list-item";

  Transforms.setNodes(editor, {
    type: nextType,
  } as Partial<RichElement>);

  if (!isActive) {
    const block = { type: format, children: [] } as RichElement;
    Transforms.wrapNodes(editor, block);
  }
}

function renderElement(props: RenderElementProps) {
  const { attributes, children, element } = props;

  if (element.type === "bulleted-list") {
    return <ul {...attributes}>{children}</ul>;
  }

  if (element.type === "numbered-list") {
    return <ol {...attributes}>{children}</ol>;
  }

  if (element.type === "list-item") {
    return <li {...attributes}>{children}</li>;
  }

  return <p {...attributes}>{children}</p>;
}

function DrawingBlockElementComponent({
  attributes,
  children,
  element,
  readOnly,
}: RenderElementProps & { element: DrawingBlockElement; readOnly: boolean }) {
  const editor = useSlateStatic();
  const sketchCanvasRef = useRef<SketchCanvasHandle | null>(null);
  const resizeHostRef = useRef<HTMLDivElement | null>(null);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const blockWidth = Math.max(element.width ?? DEFAULT_INLINE_SKETCH_WIDTH, 220);
  const blockHeight = Math.max(element.height ?? DEFAULT_INLINE_SKETCH_HEIGHT, 160);

  const updateDrawingData = (value: string | null) => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.setNodes(editor, { drawingData: value }, { at: path });
  };

  useEffect(() => {
    if (!resizeHostRef.current || readOnly) {
      return;
    }

    const resizeHost = resizeHostRef.current;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(Math.round(entry.contentRect.width), 220);
      const nextHeight = Math.max(Math.round(entry.contentRect.height), 160);

      if (nextWidth === blockWidth && nextHeight === blockHeight) {
        return;
      }

      const path = ReactEditor.findPath(editor, element);
      Transforms.setNodes(editor, { width: nextWidth, height: nextHeight }, { at: path });
    });

    resizeObserver.observe(resizeHost);

    return () => {
      resizeObserver.disconnect();
    };
  }, [blockHeight, blockWidth, editor, element, readOnly]);

  const removeDrawingBlock = () => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.removeNodes(editor, { at: path });
  };

  return (
    <div {...attributes} className="inline-sketch-block-shell">
      <div contentEditable={false} className="inline-sketch-block">
        <div className="inline-sketch-block-header">
          <strong>Sketch</strong>
          <div className="inline-sketch-block-actions">
            {!readOnly ? (
              <>
                <button
                  className="inline-sketch-action-btn"
                  type="button"
                  disabled={!historyState.canUndo}
                  onClick={() => sketchCanvasRef.current?.undo()}
                >
                  Undo
                </button>
                <button
                  className="inline-sketch-action-btn"
                  type="button"
                  disabled={!historyState.canRedo}
                  onClick={() => sketchCanvasRef.current?.redo()}
                >
                  Redo
                </button>
                <button className="inline-sketch-remove-btn" type="button" onClick={removeDrawingBlock}>
                  Remove
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div
          ref={resizeHostRef}
          className={readOnly ? "inline-sketch-resize-host read-only" : "inline-sketch-resize-host"}
          style={{ width: `${blockWidth}px`, height: `${blockHeight}px` }}
        >
          <SketchCanvas
            ref={sketchCanvasRef}
            value={element.drawingData ?? null}
            onChange={updateDrawingData}
            readOnly={readOnly}
            onHistoryChange={setHistoryState}
          />
        </div>
      </div>
      {children}
    </div>
  );
}

function renderLeaf(props: RenderLeafProps) {
  const { attributes, children, leaf } = props;
  let nextChildren = children;

  if (leaf.bold) {
    nextChildren = <strong>{nextChildren}</strong>;
  }

  if (leaf.italic) {
    nextChildren = <em>{nextChildren}</em>;
  }

  if (leaf.underline) {
    nextChildren = <u>{nextChildren}</u>;
  }

  if (leaf.highlight) {
    nextChildren = <mark>{nextChildren}</mark>;
  }

  return <span {...attributes}>{nextChildren}</span>;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor({ value, onChange, placeholder, readOnly = false }, ref) {
    const [editor] = useState(() => withDrawingBlocks(withHistory(withReact(createEditor()))));
    const [editorValue, setEditorValue] = useState<Descendant[]>(() => deserializeNoteContent(value));
    const serializedValue = useMemo(() => serializeNoteContent(editorValue), [editorValue]);

    useEffect(() => {
      if (value === serializedValue) {
        return;
      }

      setEditorValue(deserializeNoteContent(value));
    }, [serializedValue, value]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        ReactEditor.focus(editor);
      },
      toggleMark: (mark) => {
        ReactEditor.focus(editor);
        toggleMark(editor, mark);
      },
      toggleList: (type) => {
        ReactEditor.focus(editor);
        toggleList(editor, type);
      },
      insertSketch: () => {
        ReactEditor.focus(editor);
        insertSketchBlock(editor);
      },
    }), [editor]);

    const renderRichElement = (props: RenderElementProps) => {
      if (props.element.type === "drawing-block") {
        return <DrawingBlockElementComponent {...props} element={props.element} readOnly={readOnly} />;
      }

      return renderElement(props);
    };

    return (
      <Slate
        editor={editor}
        initialValue={editorValue}
        value={editorValue}
        onChange={(nextValue) => {
          setEditorValue(nextValue);
          onChange(serializeNoteContent(nextValue));
        }}
      >
        <Editable
          className="paper-editor structured-editor"
          renderElement={renderRichElement}
          renderLeaf={renderLeaf}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck
          onKeyDown={(event) => {
            if (readOnly) {
              return;
            }

            if (isHotkey(event, "b")) {
              event.preventDefault();
              toggleMark(editor, "bold");
              return;
            }

            if (isHotkey(event, "i")) {
              event.preventDefault();
              toggleMark(editor, "italic");
              return;
            }

            if (isHotkey(event, "u")) {
              event.preventDefault();
              toggleMark(editor, "underline");
              return;
            }

            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "h") {
              event.preventDefault();
              toggleMark(editor, "highlight");
              return;
            }

            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "7") {
              event.preventDefault();
              toggleList(editor, "numbered-list");
              return;
            }

            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "8") {
              event.preventDefault();
              toggleList(editor, "bulleted-list");
            }
          }}
        />
      </Slate>
    );
  }
);
