import React, { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { supabase } from '../lib/supabaseClient';

type Props = { tableId: string };

export default function TableDashboardWidget({ tableId }: Props) {
  const [rowData, setRowData] = useState<any[]>([]);
  const [columnDefs, setColumnDefs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const r = await fetch(`/api/widgets/table-dashboard?table_id=${encodeURIComponent(tableId)}&limit=10`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
        const j = await r.json();
        const cols = Array.isArray(j?.schema) ? j.schema : [];
        const rows = Array.isArray(j?.rows) ? j.rows : [];
        setRowData(rows);
        setColumnDefs(cols.map((c: any) => ({ headerName: c.name, field: c.name, sortable: true, filter: true })));
      } catch {}
    })();
  }, [tableId]);

  const gridStyle = useMemo(() => ({ width: '100%', height: '280px' }), []);

  return (
    <div className="ag-theme-alpine" style={gridStyle}>
      <AgGridReact rowData={rowData} columnDefs={columnDefs} pagination={true} paginationPageSize={10} suppressCellSelection={true} domLayout="autoHeight" />
    </div>
  );
}


