# Executive Dashboards (Universal Templates)

HirePilot supports **universal executive dashboards** that can be applied to **any** Custom Table via a quick mapping wizard.

## Why this exists

Historically, dashboards broke when they referenced **human labels** (e.g. `"Total Revenue"`) that users could rename. The universal dashboard system fixes this by using stable identifiers:

- **Table columns** are normalized to include:
  - `id` (uuid-like string)
  - `key` (stable snake_case)
  - `label` (display name)
  - `type` (money/number/date/text/status/etc)
- **Dashboards** store `column_id` / `date_column_id` (prefer `id`, fallback to `key` for compatibility).

## Data model (dashboard layout)

Dashboards are stored in `user_dashboards.layout`.

For universal (template or single-table) dashboards, the layout should store:

- `sources[]`: includes the `tableId` (Custom Table) and an `alias` used for formula refs
- `metrics[]`: each metric stores stable identifiers:
  - `column_id` (required)
  - `date_column_id` (optional, for time bucketing)
  - `agg` (`SUM|AVG|COUNT|MIN|MAX`)
  - `alias` (display label)
- optional:
  - `time_bucket` (`day|week|month|quarter|year|none`)
  - `range` (`7d|30d|90d|ytd|all_time|custom`)
  - `filters[]` as `{ column_id, op, value }`

### Backwards compatibility

Older dashboards may still have:
- `columnId` instead of `column_id`
- `dateColumn` instead of `date_column_id`

The frontend migrates these to stable ids when a dashboard is opened.

## Query API

All widgets should query through:

`POST /api/dashboards/widgets/query`

Input:
- `table_id`
- `metrics[]` with `{ agg, column_id, alias }`
- optional `date_column_id`
- `time_bucket`
- `range` (or `custom` + `range_start` / `range_end`)
- optional `filters`

Behavior guarantees:
- **No data in range** → returns `series: []` and a message (never all zeros).
- **NULL handling**:
  - `SUM`: treats null as 0
  - `AVG/MIN/MAX`: ignores null rows
  - `COUNT`: counts non-null values
- **Missing date values** are excluded from time bucketing and returned as warnings.

## Templates

Templates are mapping-driven:

- A template defines required/optional **roles** (Revenue, Cost, Date, Status, Category, etc)
- The user maps each role → a real table column (by stable column id/key)
- The dashboard is created with:
  - `layout.template_id`
  - `layout.template_table_id`
  - `layout.template_mappings` (role → column id/key)

Current templates:
- `exec_overview_v1`: Revenue/Cost/Profit/Margin + trends + at-risk list
- `pipeline_health_v1`: Upcoming items + approval distribution + optional cash risk
- `cost_drivers_v1`: Category cost breakdown + top line items + baseline variance if mapped

## Frontend routing

`/dashboards/:id` uses:
- `tpl=...` query params to render a template command center layout
- otherwise, it tries a **premium single-table renderer** if the URL layout is a single Custom Table
- multi-source dashboards fall back to the legacy dashboard view (for now)


