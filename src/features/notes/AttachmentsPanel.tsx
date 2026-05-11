import { FiDownload, FiPaperclip, FiX } from "react-icons/fi";
import type { Dispatch, SetStateAction } from "react";
import type { NoteAttachment, NoteAttachmentThumbnail } from "./noteModel";

type AttachmentsPanelProps = {
  attachments: NoteAttachment[];
  thumbnails: NoteAttachmentThumbnail[];
  draggingAttachmentId: string | null;
  attachmentDropTargetId: string | null;
  isSelectedNoteDeleted: boolean;
  formatFileSize: (bytes: number) => string;
  onRemoveAttachment: (attachmentId: string) => void;
  onReorderAttachments: (draggedId: string, targetId: string) => void;
  setDraggingAttachmentId: Dispatch<SetStateAction<string | null>>;
  setAttachmentDropTargetId: Dispatch<SetStateAction<string | null>>;
};

export function AttachmentsPanel({
  attachments,
  thumbnails,
  draggingAttachmentId,
  attachmentDropTargetId,
  isSelectedNoteDeleted,
  formatFileSize,
  onRemoveAttachment,
  onReorderAttachments,
  setDraggingAttachmentId,
  setAttachmentDropTargetId,
}: AttachmentsPanelProps) {
  return (
    <div className="attachments-strip">
      <div className="attachments-header">
        <strong>Attachments</strong>
        <span>{attachments.length} item{attachments.length === 1 ? "" : "s"}</span>
      </div>
      {attachments.length > 0 ? (
        <div className="attachments-grid">
          {attachments.map((attachment) => {
            const thumbnail = thumbnails.find((thumbnailItem) => thumbnailItem.id === attachment.id);
            const attachmentCardClassName = [
              "attachment-card",
              draggingAttachmentId === attachment.id ? "is-dragging" : "",
              attachmentDropTargetId === attachment.id ? "is-drop-target" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <article
                key={attachment.id}
                className={attachmentCardClassName}
                draggable={!isSelectedNoteDeleted}
                onDragStart={(event) => {
                  if (isSelectedNoteDeleted) {
                    event.preventDefault();
                    return;
                  }

                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", attachment.id);
                  setDraggingAttachmentId(attachment.id);
                  setAttachmentDropTargetId(attachment.id);
                }}
                onDragOver={(event) => {
                  if (
                    isSelectedNoteDeleted ||
                    !draggingAttachmentId ||
                    draggingAttachmentId === attachment.id
                  ) {
                    return;
                  }

                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setAttachmentDropTargetId(attachment.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!draggingAttachmentId || isSelectedNoteDeleted) {
                    return;
                  }

                  onReorderAttachments(draggingAttachmentId, attachment.id);
                }}
                onDragEnd={() => {
                  setDraggingAttachmentId(null);
                  setAttachmentDropTargetId(null);
                }}
              >
                {attachment.kind === "image" ? (
                  <img src={thumbnail?.thumbnailDataUrl ?? attachment.dataUrl} alt={attachment.name} className="attachment-preview" />
                ) : (
                  <div className="attachment-file-placeholder">
                    <FiPaperclip />
                  </div>
                )}
                <div className="attachment-meta">
                  <strong>{attachment.name}</strong>
                  <span>{formatFileSize(attachment.size)}</span>
                </div>
                <div className="attachment-actions">
                  <a className="icon-link-btn" href={attachment.dataUrl} download={attachment.name}>
                    <FiDownload />
                  </a>
                  <button className="icon-link-btn" type="button" disabled={isSelectedNoteDeleted} onClick={() => onRemoveAttachment(attachment.id)}>
                    <FiX />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="attachments-empty">No images or files attached yet.</div>
      )}
    </div>
  );
}