import React from 'react';

export default function PublicBreadcrumbs({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" className="w-full">
      <ol className="flex items-center text-sm text-gray-400 gap-2">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <a href={item.href} className="hover:text-white transition-colors">
                  {item.label}
                </a>
              ) : (
                <span className={isLast ? 'text-gray-300' : ''}>{item.label}</span>
              )}
              {!isLast && <span className="text-gray-500">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}


