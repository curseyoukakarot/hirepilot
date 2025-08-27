export async function makeSchedulingLink(userId: string, eventType?: string, windowDays = 10){
  const base = process.env.CALENDLY_BASE_URL || 'https://calendly.com';
  const type = eventType || 'hirepilot/15min-intro';
  return `${base}/${type}`;
}


