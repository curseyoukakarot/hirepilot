import Docker from 'dockerode';
import { OrchestratorEngine, StartOpts, StartResult } from './engine';

const docker = new Docker({ socketPath: process.env.DOCKER_HOST ? undefined : '/var/run/docker.sock', host: process.env.DOCKER_HOST });

export class DockerEngine implements OrchestratorEngine {
  async start(opts: StartOpts): Promise<StartResult> {
    const image = process.env.NOVNC_IMAGE || 'hirepilot/li-novnc:latest';
    const container = await docker.createContainer({
      Image: image,
      Env: [
        `USER_DATA_DIR=/home/chrome/user-data-dir/${opts.sessionId}`,
        `SCREEN_GEOMETRY=1366x768x24`,
        ...(opts.proxyUrl ? [`HTTPS_PROXY=${opts.proxyUrl}`, `HTTP_PROXY=${opts.proxyUrl}`] : [])
      ],
      ExposedPorts: { '8080/tcp': {}, '9222/tcp': {} },
      HostConfig: { PortBindings: { '8080/tcp': [{ HostPort: '' }], '9222/tcp': [{ HostPort: '' }] } },
      Labels: { 'hp.sessionId': opts.sessionId }
    });
    await container.start();
    const data = await container.inspect();

    const ports = (data as any)?.NetworkSettings?.Ports as any;
    const streamPort = ports?.['8080/tcp']?.[0]?.HostPort as string;
    const debugPort = ports?.['9222/tcp']?.[0]?.HostPort as string;

    const base = process.env.STREAM_PUBLIC_BASE_URL || 'http://localhost';
    const host = base.replace(/\/$/, '');
    return {
      containerId: container.id,
      streamUrl: `${host}:${streamPort}/vnc.html?autoconnect=1&resize=scale`,
      remoteDebugUrl: `ws://localhost:${debugPort}/devtools/browser`
    };
  }

  async stop(containerId: string): Promise<void> {
    const c = docker.getContainer(containerId);
    try { await c.stop({ t: 5 }); } catch {}
    try { await c.remove({ force: true }); } catch {}
  }
}


