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
}

const JOB_NAME = 'linkedin_remote_action';

export async function enqueueLinkedInRemoteAction(
  job: LinkedInRemoteActionJob,
  options?: JobsOptions
): Promise<void> {
  await linkedinRemoteActionQueue.add(JOB_NAME, job, {
    removeOnComplete: true,
    attempts: 1,
    ...options
  });
}

