import { apiAsUser } from '../server';
import { enqueueLinkedinJob } from '../../../services/linkedin-remote/queue/enqueue';

export const linkedinTools = {
  'linkedin.send_connection': {
    parameters: { userId: { type: 'string' }, profileUrl: { type: 'string' }, message: { type: 'string', optional: true } },
    handler: async ({ userId, profileUrl, message }: any) => {
      const { jobId, sessionId } = await enqueueLinkedinJob(userId, 'send_connection', { profileUrl, message });
      return { queued: true, jobId, sessionId };
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


