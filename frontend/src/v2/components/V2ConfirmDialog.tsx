/**
 * v2 — V2ConfirmDialog
 * Confirmation modal for destructive or sensitive actions.
 * For "type the workspace name to confirm" UX, pass `confirmText` and
 * the user must type it exactly to enable the primary button.
 */

import React, { useEffect, useState } from 'react';
import V2Modal, { ModalCancel, ModalPrimary } from './V2Modal';

export interface V2ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Show as red destructive action. */
  destructive?: boolean;
  /** When set, user must type this text exactly to enable the confirm button. */
  confirmText?: string;
  loading?: boolean;
  icon?: string;
}

export default function V2ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  confirmText,
  loading = false,
  icon,
}: V2ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const canConfirm = !confirmText || typed === confirmText;
  const headerIcon = icon || (destructive ? 'triangle-exclamation' : 'circle-question');
  const headerGradient = destructive
    ? 'linear-gradient(135deg,#EF4444,#DC2626)'
    : 'linear-gradient(135deg,#F59E0B,#EA580C)';

  return (
    <V2Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={headerIcon}
      iconGradient={headerGradient}
      size="md"
      footer={
        <>
          <ModalCancel onClick={onClose} label={cancelLabel} />
          <ModalPrimary
            onClick={onConfirm}
            label={confirmLabel}
            danger={destructive}
            disabled={!canConfirm}
            loading={loading}
          />
        </>
      }
    >
      <div className="text-[13.5px] text-text-secondary leading-relaxed">{message}</div>
      {confirmText && (
        <div className="mt-4">
          <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
            Type <span className="font-mono text-text-main">{confirmText}</span> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmText}
            className="mt-1.5 w-full px-3 py-2 rounded-lg text-[13px] outline-none focus:border-primary/40 font-mono"
            style={{ border: '1px solid #E5E7EB' }}
            autoFocus
          />
        </div>
      )}
    </V2Modal>
  );
}
