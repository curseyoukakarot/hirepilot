export async function listPersonas() {
  const r = await fetch('/api/personas');
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createPersona(body: any) {
  const r = await fetch('/api/personas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updatePersona(id: string, body: any) {
  const r = await fetch(`/api/personas/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deletePersona(id: string) {
  const r = await fetch(`/api/personas/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}


