export function moveId(ids: string[], id: string, toIndex: number): string[] {
  const existing = ids.filter((v) => v !== id);
  if (!existing.length) return [id];
  const safeIndex = Math.max(0, Math.min(existing.length, toIndex));
  const next = [...existing];
  next.splice(safeIndex, 0, id);
  return next;
}

export function reorderByOrderedIds(existing: string[], orderedIds: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of orderedIds) {
    if (!existing.includes(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  for (const id of existing) {
    if (seen.has(id)) continue;
    next.push(id);
  }
  return next;
}

