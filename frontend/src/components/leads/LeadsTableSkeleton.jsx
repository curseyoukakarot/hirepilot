import React from 'react';

function RowSkeleton() {
  return (
    <tr>
      <td className="px-6 py-4">
        <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
          <div className="space-y-2 w-full">
            <div className="h-4 bg-gray-200 rounded w-40 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-48 animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-56 animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-40 animate-pulse" />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="h-6 bg-gray-200 rounded-full w-24 animate-pulse" />
      </td>
      <td className="px-6 py-4">
        <div className="flex gap-2">
          <div className="h-5 bg-gray-200 rounded w-12 animate-pulse" />
          <div className="h-5 bg-gray-200 rounded w-10 animate-pulse" />
          <div className="h-5 bg-gray-200 rounded w-16 animate-pulse" />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-28 animate-pulse" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-28 animate-pulse" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
      </td>
      <td className="px-6 py-4 text-right">
        <div className="ml-auto h-8 bg-gray-200 rounded w-16 animate-pulse" />
      </td>
    </tr>
  );
}

export default function LeadsTableSkeleton({ rows = 10 }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex gap-4">
            <div className="h-10 bg-gray-200 rounded w-40 animate-pulse" />
            <div className="h-10 bg-gray-200 rounded w-56 animate-pulse" />
            <div className="h-10 bg-gray-200 rounded w-40 animate-pulse" />
          </div>
        </div>
      </div>
      <table className="min-w-full divide-y divide-gray-200 table-fixed">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3" />
            <th className="px-6 py-3" />
            <th className="px-6 py-3" />
            <th className="px-6 py-3" />
            <th className="px-6 py-3" />
            <th className="px-6 py-3" />
            <th className="px-6 py-3" />
            <th className="px-6 py-3" />
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, idx) => (
            <RowSkeleton key={idx} />
          ))}
        </tbody>
      </table>
    </div>
  );
}


