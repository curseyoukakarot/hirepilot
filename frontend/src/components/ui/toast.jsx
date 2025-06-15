import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import * as Toast from '@radix-ui/react-toast';

const ToastPrimitive = React.forwardRef(({ className, title, description, action, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
        className
      )}
      {...props}
    >
      <div className="grid gap-1">
        {title && <div className="text-sm font-semibold">{title}</div>}
        {description && <div className="text-sm opacity-90">{description}</div>}
      </div>
      {action}
      <button className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
});

ToastPrimitive.displayName = 'ToastPrimitive';

export default function Toaster({ open, onOpenChange, children }) {
  return (
    <Toast.Provider swipeDirection="right">
      <Toast.Root open={open} onOpenChange={onOpenChange}>
        {children}
      </Toast.Root>
      <Toast.Viewport className="fixed bottom-0 right-0 p-6" />
    </Toast.Provider>
  );
}

export { ToastPrimitive }; 