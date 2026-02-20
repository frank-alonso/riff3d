"use client";

import { useEffect, useRef, useCallback } from "react";

interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the user confirms */
  onConfirm: () => void;
  /** Called when the user cancels (Escape, backdrop click, or Cancel button) */
  onCancel: () => void;
  /** Dialog title */
  title: string;
  /** Dialog message body */
  message: string;
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Label for the cancel button (default: "Cancel") */
  cancelLabel?: string;
}

/**
 * Reusable confirmation dialog component.
 *
 * Centered modal with backdrop blur. Escape key and backdrop click cancel.
 * Focus traps on the confirm button when opened.
 *
 * Styled to match the editor dark theme using CSS variable-based colors.
 */
export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button when dialog opens
  useEffect(() => {
    if (open) {
      // Delay focus to allow the dialog to render
      requestAnimationFrame(() => {
        confirmRef.current?.focus();
      });
    }
  }, [open]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel],
  );

  // Backdrop click handler
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl">
        {/* Title */}
        <h2
          id="confirm-dialog-title"
          className="mb-2 text-sm font-semibold text-[var(--foreground)]"
        >
          {title}
        </h2>

        {/* Message */}
        <p className="mb-5 text-xs leading-relaxed text-[var(--muted-foreground)]">
          {message}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent)]/80 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
