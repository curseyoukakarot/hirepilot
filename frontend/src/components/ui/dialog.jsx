import React from 'react';
import { FaXmark } from 'react-icons/fa6';

export function Dialog({ isOpen, onClose, children, className = "" }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg w-full max-w-md p-6 ${className}`}>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children, onClose }) {
  return (
    <div className="flex justify-between items-center mb-4">
      {children}
      {onClose && (
        <button 
          onClick={onClose} 
          className="text-gray-400 hover:text-gray-600"
        >
          <FaXmark />
        </button>
      )}
    </div>
  );
}

export function DialogTitle({ children, className = "" }) {
  return (
    <h2 className={`text-xl font-semibold ${className}`}>
      {children}
    </h2>
  );
}

export function DialogContent({ children, className = "" }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {children}
    </div>
  );
}

export function DialogFooter({ children, className = "" }) {
  return (
    <div className={`flex justify-end space-x-3 pt-4 ${className}`}>
      {children}
    </div>
  );
}