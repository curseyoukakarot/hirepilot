import Docker from 'dockerode';
import { OrchestratorEngine, StartOpts, StartResult } from './engine';
import fs from 'node:fs';
import path from 'node:path';

function getDocker(): Docker {
  const dockerHost = process.env.DOCKER_HOST;
  if (dockerHost) {
    const opts: any = { host: dockerHost };
    const tls = String(process.env.DOCKER_TLS_VERIFY || '').trim();
    if (tls === '1' || tls.toLowerCase() === 'true') {
      // Prefer env-provided PEMs to avoid filesystem reliance
      const fromEnvMaybe = () => {
        const caB64 = process.env.DOCKER_CA_PEM_B64 || '';
        const certB64 = process.env.DOCKER_CERT_PEM_B64 || '';
        const keyB64 = process.env.DOCKER_KEY_PEM_B64 || '';
        const caText = process.env.DOCKER_CA_PEM || '';
        const certText = process.env.DOCKER_CERT_PEM || '';
        const keyText = process.env.DOCKER_KEY_PEM || '';
        const dec = (b64: string, text: string) => {
          if (text && /BEGIN [A-Z ]+/.test(text)) return Buffer.from(text, 'utf8');
          if (b64) {
            const buf = Buffer.from(b64, 'base64');
            // If the decoded buffer already looks like text PEM, return as text; else return raw buffer (dockerode accepts raw)
            const txt = buf.toString('utf8');
            if (/BEGIN [A-Z ]+/.test(txt)) return Buffer.from(txt, 'utf8');
            return buf;
          }
          return null;
        };
        const ca = dec(caB64, caText);
        const cert = dec(certB64, certText);
        const key = dec(keyB64, keyText);
        if (ca && cert && key) return { ca, cert, key } as any;
        return null;
      };

      const envPems = fromEnvMaybe();
      if (envPems) {
        opts.ca = envPems.ca;
        opts.cert = envPems.cert;
        opts.key = envPems.key;
      } else {
        const certDir = process.env.DOCKER_CERT_PATH || '';
        const caPath = path.join(certDir, 'ca.pem');
        const certPath = path.join(certDir, 'cert.pem');
        const keyPath = path.join(certDir, 'key.pem');
        if (!(fs.existsSync(caPath) && fs.existsSync(certPath) && fs.existsSync(keyPath))) {
          throw new Error(`Docker TLS enabled but certs not found in env or ${certDir}. Expected ca.pem, cert.pem, key.pem`);
        }
        opts.ca = fs.readFileSync(caPath);
        opts.cert = fs.readFileSync(certPath);
        opts.key = fs.readFileSync(keyPath);
      }
    }
    return new Docker(opts);
  }
  return new Docker({ socketPath: '/var/run/docker.sock' });
}

export class DockerEngine implements OrchestratorEngine {
  async start(opts: StartOpts): Promise<StartResult> {
    const docker = getDocker();
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
    const docker = getDocker();
    const c = docker.getContainer(containerId);
    try { await c.stop({ t: 5 }); } catch {}
    try { await c.remove({ force: true }); } catch {}
  }
}


