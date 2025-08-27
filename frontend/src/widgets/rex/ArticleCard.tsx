import React from 'react';

type Props = {
  title: string;
  excerpt: string;
  url: string;
};

export const ArticleCard: React.FC<Props> = ({ title, excerpt, url }) => {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm hover:border-gray-300 hover:shadow">
      <div className="text-sm font-semibold text-gray-900 line-clamp-1">{title}</div>
      <div className="mt-1 text-xs text-gray-600 line-clamp-2">{excerpt}</div>
      <div className="mt-2 text-xs font-medium text-blue-600">Open →</div>
    </a>
  );
};

export default ArticleCard;


