import React from 'react';

export function Button({ variant = 'default', className = '', children, ...rest }) {
  const base = 'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  const styles = variant === 'outline'
    ? 'border border-gray-300 text-gray-700 bg-transparent hover:bg-gray-50'
    : 'bg-blue-600 text-white hover:bg-blue-700';
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export default Button;