export interface MetricsSnapshot {
  date: string; // YYYY-MM-DD
  apiCalls: number;
  failedCalls: number;
}

let currentDate = new Date().toISOString().slice(0, 10);
let apiCalls = 0;
let failedCalls = 0;

function rollOverIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentDate) {
    currentDate = today;
    apiCalls = 0;
    failedCalls = 0;
  }
}

export function incrementApiCalls() {
  rollOverIfNeeded();
  apiCalls += 1;
}

export function incrementFailedCalls() {
  rollOverIfNeeded();
  failedCalls += 1;
}

export function getMetrics(): MetricsSnapshot {
  rollOverIfNeeded();
  return { date: currentDate, apiCalls, failedCalls };
} 