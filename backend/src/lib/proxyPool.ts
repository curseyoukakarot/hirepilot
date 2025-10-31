export interface ProxyInfo {
  id: string;
  url: string;
  healthScore: number;
}

let roundRobin = 0;

// Minimal stub for selecting a proxy; replace with DB-backed pool
export async function getHealthyProxy(): Promise<ProxyInfo | null> {
  const list: ProxyInfo[] = [];
  if (list.length === 0) return null;
  roundRobin = (roundRobin + 1) % list.length;
  return list[roundRobin];
}


