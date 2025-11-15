import React from 'react';

export function Button({ variant = 'default', className = '', children, ...rest }) {
  const base = 'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none';
  const styles = variant === 'outline'
    ? 'border border-gray-300 text-gray-700 bg-transparent hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
    : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500';
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export default Button;