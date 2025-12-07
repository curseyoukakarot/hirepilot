import { enqueueLinkedinJob } from '../../../services/linkedin-remote/queue/enqueue';
import { LinkedInRemoteActionType } from '../../services/brightdataBrowser';

type RemoteActionInvoker = (input: {
  userId: string;
  action: LinkedInRemoteActionType;
  linkedinUrl: string;
  message?: string;
}) => Promise<any>;

export function buildLinkedinTools(invokeRemoteAction: RemoteActionInvoker) {
  return {
    'linkedin.send_connection': {
      parameters: { userId: { type: 'string' }, profileUrl: { type: 'string' }, message: { type: 'string', optional: true } },
      handler: async ({ userId, profileUrl, message }: any) => {
        await invokeRemoteAction({
          userId,
          action: 'connect_request',
          linkedinUrl: profileUrl,
          message
        });
        return { queued: true };
      }
    },
    'linkedin.send_message': {
      parameters: { userId: { type: 'string' }, profileUrl: { type: 'string' }, message: { type: 'string' } },
      handler: async ({ userId, profileUrl, message }: any) => {
        await invokeRemoteAction({
          userId,
          action: 'send_message',
          linkedinUrl: profileUrl,
          message
        });
        return { queued: true };
      }
    },
    'linkedin.scrape_search': {
      parameters: { userId: { type: 'string' }, searchUrl: { type: 'string' }, maxResults: { type: 'number', optional: true } },
      handler: async ({ userId, searchUrl, maxResults }: any) => {
        const { jobId, sessionId } = await enqueueLinkedinJob(userId, 'scrape_search', { searchUrl, maxResults });
        return { queued: true, jobId, sessionId };
      }
    },
    'linkedin.visit_profile': {
      parameters: { userId: { type: 'string' }, profileUrl: { type: 'string' } },
      handler: async ({ userId, profileUrl }: any) => {
        const { jobId, sessionId } = await enqueueLinkedinJob(userId, 'visit_profile', { profileUrl });
        return { queued: true, jobId, sessionId };
      }
    }
  };
}

