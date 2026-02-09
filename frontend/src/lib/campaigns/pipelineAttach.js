const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

export async function fetchPipelines({ token, jobId } = {}) {
  const url = new URL(`${API_BASE_URL}/pipelines`);
  if (jobId) url.searchParams.set('jobId', jobId);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: 'include'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to fetch pipelines');
  return data.pipelines || [];
}

export async function ensureCampaignJob({ token, campaign, title }) {
  if (campaign?.job_id) {
    return { jobId: campaign.job_id, job: null, created: false };
  }
  const response = await fetch(`${API_BASE_URL}/jobs/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ title: title || 'Campaign Job' })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Failed to create job');
  return { jobId: data?.jobId, job: data?.job || null, created: true };
}

export async function attachPipelineToJob({ token, jobId, pipelineId }) {
  if (!jobId || !pipelineId) {
    throw new Error('Missing job or pipeline');
  }
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ pipeline_id: pipelineId })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Failed to attach pipeline');
  return data;
}
