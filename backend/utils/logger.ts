/* Simple structured logger */
export const log = {
  info: (msg: string, meta?: Record<string, any>) =>
    console.log(JSON.stringify({ level: 'info', msg, timestamp: new Date().toISOString(), ...meta })),
  warn: (msg: string, meta?: Record<string, any>) =>
    console.warn(JSON.stringify({ level: 'warn', msg, timestamp: new Date().toISOString(), ...meta })),
  error: (msg: string, meta?: Record<string, any>) =>
    console.error(JSON.stringify({ level: 'error', msg, timestamp: new Date().toISOString(), ...meta })),
};
