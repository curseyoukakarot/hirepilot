import { runWidgetQuery, type TableColumn } from './widgetQueryEngine';

describe('widgetQueryEngine.runWidgetQuery', () => {
  test('SUM treats NULL as 0; AVG ignores NULL; COUNT ignores NULL', () => {
    const schema: TableColumn[] = [
      { id: 'amount', key: 'amount', label: 'Amount', type: 'number' }
    ];
    const rows = [
      { amount: null },
      { amount: '' },
      { amount: 5 },
      { amount: '7' }
    ];

    const sumOut = runWidgetQuery(
      { table_id: 't1', metrics: [{ alias: 'A', agg: 'SUM', column_id: 'amount' }], time_bucket: 'none', range: 'all_time' },
      schema,
      rows
    );
    expect(sumOut.series).toEqual([{ t: 'ALL', A: 12 }]);

    const avgOut = runWidgetQuery(
      { table_id: 't1', metrics: [{ alias: 'A', agg: 'AVG', column_id: 'amount' }], time_bucket: 'none', range: 'all_time' },
      schema,
      rows
    );
    expect(avgOut.series).toEqual([{ t: 'ALL', A: 6 }]); // (5 + 7) / 2

    const countOut = runWidgetQuery(
      { table_id: 't1', metrics: [{ alias: 'A', agg: 'COUNT', column_id: 'amount' }], time_bucket: 'none', range: 'all_time' },
      schema,
      rows
    );
    expect(countOut.series).toEqual([{ t: 'ALL', A: 2 }]);
  });

  test('Month bucketing groups by YYYY-MM and excludes invalid dates with a warning', () => {
    const schema: TableColumn[] = [
      { id: 'd', key: 'd', label: 'Date', type: 'date' },
      { id: 'amt', key: 'amt', label: 'Amount', type: 'number' }
    ];
    const rows = [
      { d: '2025-01-02', amt: 10 },
      { d: '2025-01-20', amt: 5 },
      { d: '2025-02-01', amt: 7 },
      { d: null, amt: 999 } // should be excluded for bucketing
    ];

    const out = runWidgetQuery(
      { table_id: 't1', metrics: [{ alias: 'A', agg: 'SUM', column_id: 'amt' }], date_column_id: 'd', time_bucket: 'month', range: 'all_time' },
      schema,
      rows
    );

    expect(out.series).toEqual([
      { t: '2025-01', A: 15 },
      { t: '2025-02', A: 7 }
    ]);
    expect(out.warnings.join(' ')).toContain('missing a valid date');
  });

  test('Custom range filters rows by date column', () => {
    const schema: TableColumn[] = [
      { id: 'd', key: 'd', label: 'Date', type: 'date' },
      { id: 'amt', key: 'amt', label: 'Amount', type: 'number' }
    ];
    const rows = [
      { d: '2025-01-01', amt: 1 },
      { d: '2025-01-10', amt: 2 },
      { d: '2025-02-01', amt: 100 }
    ];

    const out = runWidgetQuery(
      {
        table_id: 't1',
        metrics: [{ alias: 'A', agg: 'SUM', column_id: 'amt' }],
        date_column_id: 'd',
        time_bucket: 'none',
        range: 'custom',
        range_start: '2025-01-01T00:00:00.000Z',
        range_end: '2025-01-31T23:59:59.999Z'
      },
      schema,
      rows
    );

    expect(out.series).toEqual([{ t: 'ALL', A: 3 }]);
  });
});


