export type StartOpts = { sessionId: string; userId: string; runtime: 'novnc'|'webrtc'; proxyUrl?: string };
export type StartResult = { containerId: string; streamUrl: string; remoteDebugUrl: string };

export interface OrchestratorEngine {
  start(opts: StartOpts): Promise<StartResult>;
  stop(containerId: string): Promise<void>;
}


