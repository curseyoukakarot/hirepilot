export function setRefCookie(code: string) {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  document.cookie = `hp_ref=${code}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
}

export function getRefCookie(): string | null {
  return document.cookie.split('; ').find(r => r.startsWith('hp_ref='))?.split('=')[1] ?? null;
}


