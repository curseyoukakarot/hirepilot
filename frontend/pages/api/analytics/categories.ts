export default async function handler(_req: any, res: any) {
  // Hard-coded library listing to match the front-end
  const data = {
    deals: [
      { id: 'Revenue Forecast', type: 'revenue-forecast' },
      { id: 'Deal Pipeline', type: 'deal-pipeline' },
      { id: 'Win Rate KPI', type: 'win-rate' },
      { id: 'Engagement Breakdown', type: 'engagement' },
    ],
    jobs: [
      { id: 'Hiring Funnel', type: 'hiring-funnel' },
      { id: 'Candidate Flow Viz', type: 'candidate-flow' },
      { id: 'Pipeline Velocity', type: 'pipeline-velocity' },
      { id: 'Team Performance', type: 'team-performance' },
    ],
    outreach: [
      { id: 'Reply Rate Chart', type: 'reply-rate' },
      { id: 'Open Rate Widget', type: 'open-rate' },
      { id: 'Conversion Trends', type: 'conversion-trends' },
      { id: 'Activity Overview', type: 'activity-overview' },
    ],
    rex: [
      { id: 'Hires by Source', type: 'rex-attribution' },
      { id: 'Q4 Revenue Projection', type: 'rex-revenue' },
    ],
  };
  res.status(200).json({ data });
}


