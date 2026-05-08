/**
 * v2 — V2Dropdown
 * Lightweight popover menu anchored to a trigger element. Used for
 * trust-level menus, sort menus, ellipsis context menus, etc.
 *
 * Click-outside + Escape close. Renders inline (not portal) since it's
 * always near its trigger.
 */

import React, { useEffect, useRef, useState, ReactNode } from 'react';

export interface V2DropdownItem {
  key: string;
  label: ReactNode;
  icon?: string;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  /** Render this item as a divider line. */
  divider?: boolean;
  /** Header label (uppercase muted text). */
  header?: boolean;
}

export interface V2DropdownProps {
  trigger: ReactNode;          // What the user clicks to open the menu
  items: V2DropdownItem[];
  /** Alignment of the popover relative to the trigger. */
  align?: 'left' | 'right';
  /** Open above instead of below. */
  placement?: 'top' | 'bottom';
  /** Min width in pixels. Default 200. */
  minWidth?: number;
}

export default function V2Dropdown({
  trigger,
  items,
  align = 'right',
  placement = 'bottom',
  minWidth = 200,
}: V2DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button type="button" onClick={() => setOpen((v) => !v)} className="contents">
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute z-30 bg-white rounded-xl shadow-xl py-1.5 border border-gray-100 float-in"
          style={{
            minWidth,
            top: placement === 'bottom' ? '100%' : 'auto',
            bottom: placement === 'top' ? '100%' : 'auto',
            left: align === 'left' ? 0 : 'auto',
            right: align === 'right' ? 0 : 'auto',
            marginTop: placement === 'bottom' ? 6 : 0,
            marginBottom: placement === 'top' ? 6 : 0,
            boxShadow: '0 18px 40px -12px rgba(15,15,26,.25), 0 4px 12px -4px rgba(15,15,26,.1)',
          }}
        >
          {items.map((item, i) => {
            if (item.divider) {
              return <div key={`div-${i}`} className="border-t border-gray-100 my-1" />;
            }
            if (item.header) {
              return (
                <div key={`hdr-${i}`} className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  {item.label}
                </div>
              );
            }
            return (
              <button
                key={item.key}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick?.();
                  setOpen(false);
                }}
                disabled={item.disabled}
                role="menuitem"
                className={`w-full px-3 py-2 flex items-center gap-2.5 text-left text-[12.5px] disabled:opacity-50 ${
                  item.destructive ? 'text-danger hover:bg-danger/5' : 'hover:bg-surface'
                } ${item.selected ? 'bg-primary/5' : ''}`}
              >
                {item.icon && (
                  <i className={`fa-solid fa-${item.icon} text-[10.5px] w-3.5 ${item.destructive ? 'text-danger' : 'text-text-muted'}`} />
                )}
                <span className="flex-1">{item.label}</span>
                {item.selected && <i className="fa-solid fa-check text-primary text-[10px]" />}
                {item.shortcut && <span className="text-[10px] text-text-muted font-mono">{item.shortcut}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
