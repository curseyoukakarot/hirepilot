import React from 'react';

type Props = {
  items: any[];
  values: any[];
  onOpen: (responseId: string) => void;
};

export function ResponsesTable({ items, values, onOpen }: Props) {
  const byResponse: Record<string, any[]> = {};
  for (const v of values || []) {
    const key = v.response_id;
    if (!byResponse[key]) byResponse[key] = [];
    byResponse[key].push(v);
  }
  return (
    <table className="w-full text-sm border">
      <thead>
        <tr className="bg-muted/40">
          <th className="text-left p-2 border-r">Submitted</th>
          <th className="text-left p-2 border-r">Source</th>
          <th className="text-left p-2">Values</th>
        </tr>
      </thead>
      <tbody>
        {items.map((r: any) => {
          const vals = (byResponse[r.id] || []).slice(0, 3);
          return (
            <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => onOpen(r.id)}>
              <td className="p-2">{new Date(r.submitted_at).toLocaleString()}</td>
              <td className="p-2">{r.source || '-'}</td>
              <td className="p-2">
                {vals.map((v: any, i: number) => (
                  <span key={i} className="inline-block mr-2 text-muted-foreground">
                    {v.value || v.file_url || (v.json_value ? JSON.stringify(v.json_value) : '')}
                  </span>
                ))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default ResponsesTable;


