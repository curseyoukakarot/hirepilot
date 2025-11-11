import React, { useEffect, useState } from 'react';
import { createForm, listForms } from '../../lib/api/forms';

export default function FormsHome() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await listForms();
        if (!mounted) return;
        setItems(data.items || []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function handleCreate() {
    const f = await createForm({ title: 'Untitled Form', is_public: true });
    // naive refresh
    setItems(prev => [f, ...prev]);
  }

  if (loading) return <div className="p-4">Loading…</div>;
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Forms</h1>
        <button className="px-3 py-2 bg-primary text-primary-foreground rounded" onClick={handleCreate}>New Form</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((f) => (
          <a key={f.id} className="border rounded p-3 hover:bg-muted/30" href={`/forms/${f.id}`}>
            <div className="font-medium">{f.title}</div>
            <div className="text-xs text-muted-foreground mt-1">/{f.slug}</div>
          </a>
        ))}
      </div>
    </div>
  );
}


