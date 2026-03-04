import React, { FC, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  content: string;
  streaming?: boolean;
};

const MarkdownContent: FC<Props> = memo(({ content, streaming }) => {
  return (
    <div className="rex-markdown text-sm text-gray-300 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-white mb-2 mt-4 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-white mb-2 mt-3 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-white mb-1 mt-2 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-medium text-white mb-1 mt-2 first:mt-0">{children}</h4>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-gray-300">{children}</li>,
          code: ({ className, children }) => {
            const isBlock = !!className;
            if (!isBlock) {
              return (
                <code className="bg-dark-700 text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono">
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-dark-800 rounded-lg p-3 mb-2 overflow-x-auto">
                <code className="text-xs font-mono text-gray-200">{children}</code>
              </pre>
            );
          },
          pre: ({ children }) => <>{children}</>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-purple-500 pl-3 my-2 text-gray-400 italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full text-xs border border-dark-700">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => (
            <th className="bg-dark-800 px-3 py-1.5 text-left font-semibold text-white border-b border-dark-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 border-b border-dark-800">{children}</td>
          ),
          hr: () => <hr className="border-dark-700 my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && <span className="caret-blink text-purple-400">|</span>}
    </div>
  );
});

MarkdownContent.displayName = 'MarkdownContent';
export default MarkdownContent;
