export function pickModel(primary: string, fallbacks: string[]): string[] {
  const ordered = [primary, ...fallbacks].map((value) => String(value || '').trim()).filter(Boolean);
  return [...new Set(ordered)];
}

export function isModelAvailabilityError(input: unknown, status?: number): boolean {
  const message = String(
    (input as any)?.error?.message || (input as any)?.message || (input as any)?.detail || input || ''
  ).toLowerCase();
  const hasModelSignal = message.includes('model');
  const hasAvailabilitySignal =
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('unsupported') ||
    message.includes('not available') ||
    message.includes('access') ||
    message.includes('permission');
  if (typeof status === 'number' && (status === 404 || status === 400 || status === 403) && hasModelSignal) {
    return true;
  }
  return hasModelSignal && hasAvailabilitySignal;
}
