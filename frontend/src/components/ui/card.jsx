import React from 'react';

export function Card({ className = '', children, ...rest }) {
  return <div className={`rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`} {...rest}>{children}</div>;
}

export function CardHeader({ className = '', children, ...rest }) {
  return <div className={`flex flex-col space-y-1.5 p-6 border-b border-gray-200 dark:border-gray-800 ${className}`} {...rest}>{children}</div>;
}

export function CardContent({ className = '', children, ...rest }) {
  return <div className={`p-6 ${className}`} {...rest}>{children}</div>;
}

export function CardFooter({ className = '', children, ...rest }) {
  return <div className={`flex items-center p-6 pt-0 ${className}`} {...rest}>{children}</div>;
}

export default Card;