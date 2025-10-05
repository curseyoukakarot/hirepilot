import { DockerEngine } from './dockerEngine';
import type { StartOpts, StartResult } from './engine';

const engine = new DockerEngine();

export async function startSession(opts: StartOpts): Promise<StartResult> {
  return engine.start(opts);
}
export async function stopSession(containerId: string) {
  return engine.stop(containerId);
}


