import type { Request, Response } from 'express';
import { connection, linkedinRemoteActionQueue } from '../queues/redis';

export async function workersHealth(_req: Request, res: Response) {
  try {
    const ping = await connection.ping();
    const counts = await linkedinRemoteActionQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    return res.json({
      redis: ping === 'PONG' ? 'ok' : 'unknown',
      linkedinRemoteActionWorker: 'ok',
      linkedinRemoteActionQueue: {
        name: 'linkedin:remote_action',
        counts
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      redis: 'error',
      linkedinRemoteActionWorker: 'error',
      error: err?.message || 'workers_health_failed'
    });
  }
}

