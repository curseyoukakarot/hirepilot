export async function listSchedules() {
  const r = await fetch('/api/schedules');
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createSchedule(body: any) {
  const r = await fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateSchedule(id: string, body: any) {
  const r = await fetch(`/api/schedules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteSchedule(id: string) {
  const r = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}


