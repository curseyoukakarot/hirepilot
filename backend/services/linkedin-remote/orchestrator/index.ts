import { DockerEngine } from './dockerEngine';
import type { StartOpts, StartResult } from './engine';
import { startWebrtcSession } from '../stream/webrtc';

const engine = new DockerEngine();

export async function startSession(opts: StartOpts): Promise<StartResult> {
  const mode = (opts.runtime || 'novnc');
  // If Docker socket is unavailable and mode is novnc, fall back to WebRTC when configured
  if (mode === 'novnc') {
    const canUseDocker = Boolean(process.env.DOCKER_HOST || require('fs').existsSync('/var/run/docker.sock'));
    if (!canUseDocker && process.env.LINKEDIN_STREAM_MODE === 'webrtc') {
      const r = await startWebrtcSession(opts.sessionId);
      return { containerId: 'webrtc', streamUrl: r.streamUrl, remoteDebugUrl: r.remoteDebugUrl };
    }
  }
  return engine.start(opts);
}
export async function stopSession(containerId: string) {
  return engine.stop(containerId);
}


