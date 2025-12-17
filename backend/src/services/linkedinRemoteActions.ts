import { JobsOptions } from 'bullmq';
import { linkedinRemoteActionQueue } from '../queues/redis';
import { LinkedInRemoteActionType } from './brightdataBrowser';

export interface LinkedInRemoteActionJob {
  userId: string;
  accountId?: string | null;
  leadId?: string;
  candidateId?: string;
  action: LinkedInRemoteActionType;
  linkedinUrl: string;
  message?: string;
  triggeredBy?: string;
  /**
   * When true, the job is queued via the test harness endpoint and should write
   * success/failure into linkedin_remote_action_logs.
   */
  testRun?: boolean;
  testLogId?: string;
}

const JOB_NAME = 'linkedin_remote_action';

export async function enqueueLinkedInRemoteAction(
  job: LinkedInRemoteActionJob,
  options?: JobsOptions
): Promise<string> {
  const queued = await linkedinRemoteActionQueue.add(JOB_NAME, job, {
    removeOnComplete: true,
    attempts: 1,
    ...options
  });
  return String(queued.id);
}

