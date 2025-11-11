import React, { useEffect, useMemo, useState } from 'react';
import { getResponse, listResponses } from '../../lib/api/forms';
import ResponsesTable from '../../components/forms/responses/ResponsesTable';
import ResponseDrawer from '../../components/forms/responses/ResponseDrawer';

export default function FormResponsesPage() {
  const id = useMemo(() => {
    const parts = window.location.pathname.split('/');
    return parts[parts.length - 2]; // e.g. /forms/:id/responses
  }, []);
  const [loading, setLoading] = useState(true);
  const [page] = useState(1);
  const [items, setItems] = useState<any[]>([]);
  const [values, setValues] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailValues, setDetailValues] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await listResponses(id, { page });
        if (!mounted) return;
        setItems(data.items || []);
        setValues(data.values || []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, page]);

  async function handleOpen(responseId: string) {
    const d = await getResponse(id, responseId);
    setDetail(d.response);
    setDetailValues(d.values || []);
    setOpen(true);
  }

  if (loading) return <div className="p-4">Loading…</div>;
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Responses</h1>
      </div>
      <ResponsesTable items={items} values={values} onOpen={handleOpen} />
      <ResponseDrawer open={open} onClose={() => setOpen(false)} response={detail} values={detailValues} />
    </div>
  );
}


