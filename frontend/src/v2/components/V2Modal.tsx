/**
 * v2 — V2Modal
 * Centered modal with backdrop blur, escape-to-close, click-outside-to-close.
 * Matches v2's light aesthetic — white card with rounded-2xl + soft shadow,
 * gradient header bar.
 */

import React, { useEffect, useRef, ReactNode } from 'react';

export interface V2ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: string;          // FontAwesome name without leading 'fa-'
  iconGradient?: string;  // CSS gradient string for the icon background
  children: ReactNode;
  /** Footer with actions (Save / Cancel / Delete buttons). */
  footer?: ReactNode;
  /** 'sm' | 'md' | 'lg' | 'xl' — controls max-width. Default 'md'. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Hide the close X in the header (e.g., for required-action dialogs). */
  hideClose?: boolean;
}

const SIZE_TO_MAX = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function V2Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  iconGradient = 'linear-gradient(135deg,#6B46C1,#0C5CF4)',
  children,
  footer,
  size = 'md',
  hideClose = false,
}: V2ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Lock body scroll while open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,15,26,.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={cardRef}
        className={`bg-white rounded-2xl shadow-2xl w-full ${SIZE_TO_MAX[size]} float-in overflow-hidden`}
        style={{ boxShadow: '0 30px 60px -20px rgba(15,15,26,.45), 0 8px 18px -8px rgba(15,15,26,.25)' }}
      >
        {(title || icon) && (
          <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
            {icon && (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 shadow-md"
                style={{ background: iconGradient, boxShadow: '0 6px 14px -4px rgba(107,70,193,.4)' }}
              >
                <i className={`fa-solid fa-${icon} text-[14px]`} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {title && <div className="text-[15px] font-bold tracking-tight">{title}</div>}
              {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
            </div>
            {!hideClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-md hover:bg-surface flex items-center justify-center text-text-muted shrink-0"
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark text-[13px]" />
              </button>
            )}
          </div>
        )}

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-5 py-3 border-t border-gray-100 bg-surface/30 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Standard cancel button for modal footers. */
export function ModalCancel({ onClick, label = 'Cancel' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="ghost-btn">
      {label}
    </button>
  );
}

/** Standard primary action button for modal footers. */
export function ModalPrimary({
  onClick, label, icon, disabled, loading, danger,
}: {
  onClick: () => void;
  label: string;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={danger ? 'btn-solid !bg-danger' : 'btn-solid'}
      style={danger ? { background: '#EF4444' } : undefined}
    >
      {icon || loading ? (
        <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : `fa-${icon}`} text-[10px]`} />
      ) : null}
      {loading ? 'Working…' : label}
    </button>
  );
}
