import Docker from 'dockerode';
import { OrchestratorEngine, StartOpts, StartResult } from './engine';
import fs from 'node:fs';
import path from 'node:path';

function getDocker(): Docker {
  const dockerHost = process.env.DOCKER_HOST;
  if (dockerHost) {
    const opts: any = { host: dockerHost };
    const tls = String(process.env.DOCKER_TLS_VERIFY || '').trim();
    const debugTls = (() => { const v = String(process.env.DOCKER_TLS_DEBUG || '').toLowerCase(); return v === '1' || v === 'true'; })();
    if (tls === '1' || tls.toLowerCase() === 'true') {
      // Prefer env-provided PEMs to avoid filesystem reliance
      const fromEnvMaybe = () => {
        const caB64 = process.env.DOCKER_CA_PEM_B64 || '';
        const certB64 = process.env.DOCKER_CERT_PEM_B64 || '';
        const keyB64 = process.env.DOCKER_KEY_PEM_B64 || '';
        const caText = process.env.DOCKER_CA_PEM || '';
        const certText = process.env.DOCKER_CERT_PEM || '';
        const keyText = process.env.DOCKER_KEY_PEM || '';
        const toPem = (b64: string, text: string, kind: 'CERTIFICATE' | 'PRIVATE KEY') => {
          if (text && /-----BEGIN [A-Z ]+-----/.test(text)) return Buffer.from(text, 'utf8');
          if (!b64) return null;
          const rawTxt = Buffer.from(b64, 'base64').toString('utf8');
          if (/-----BEGIN [A-Z ]+-----/.test(rawTxt)) return Buffer.from(rawTxt, 'utf8');
          // Wrap as PEM if it's raw/base64 body
          const body = Buffer.from(b64, 'base64').toString('base64').replace(/(.{64})/g, '$1\n');
          const pem = `-----BEGIN ${kind}-----\n${body}\n-----END ${kind}-----\n`;
          return Buffer.from(pem, 'utf8');
        };
        const ca = toPem(caB64, caText, 'CERTIFICATE');
        const cert = toPem(certB64, certText, 'CERTIFICATE');
        const key = toPem(keyB64, keyText, 'PRIVATE KEY');
        if (ca && cert && key) return { ca, cert, key } as any;
        return null;
      };

      const envPems = fromEnvMaybe();
      const logPemPreview = (label: string, buf?: Buffer) => {
        if (!debugTls) return;
        try {
          if (!buf) { console.log(`[TLS] ${label}: missing`); return; }
          const txt = buf.toString('utf8');
          const first80 = txt.slice(0, 80).replace(/\n/g, '\\n');
          console.log(`[TLS] ${label}: len=${buf.length} first80=${first80}`);
        } catch (e) { console.log(`[TLS] ${label}: preview failed`, e); }
      };
      if (envPems) {
        opts.ca = envPems.ca;
        opts.cert = envPems.cert;
        opts.key = envPems.key;
        logPemPreview('env.ca', opts.ca);
        logPemPreview('env.cert', opts.cert);
        logPemPreview('env.key', opts.key);
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
        logPemPreview('file.ca', opts.ca);
        logPemPreview('file.cert', opts.cert);
        logPemPreview('file.key', opts.key);
      }
    }
    // Optional: support PKCS#12 client bundle
    const p12B64 = process.env.DOCKER_CLIENT_P12_B64 || '';
    const p12Pass = process.env.DOCKER_CLIENT_P12_PASS || '';
    if (p12B64) {
      try {
        (opts as any).pfx = Buffer.from(p12B64, 'base64');
        if (p12Pass) (opts as any).passphrase = p12Pass;
        // If pfx provided, drop separate cert/key to avoid ambiguity
        delete opts.cert; delete opts.key;
        if (debugTls) console.log('[TLS] using PFX bundle, len=', (opts as any).pfx.length, 'pass=', p12Pass ? 'yes' : 'no');
      } catch (e) {
        console.log('[TLS] failed to load P12 bundle:', (e as any)?.message);
      }
    }

    // Ensure strings and normalized formatting for docker-modem / Node TLS
    if (opts.ca && Buffer.isBuffer(opts.ca)) opts.ca = (opts.ca as Buffer).toString('utf8');
    if (opts.cert && Buffer.isBuffer(opts.cert)) opts.cert = (opts.cert as Buffer).toString('utf8');
    if (opts.key && Buffer.isBuffer(opts.key)) opts.key = (opts.key as Buffer).toString('utf8');
    if (typeof opts.ca === 'string') {
      const s = (opts.ca as string).trim();
      // Allow multiple CAs separated by \n\n
      const parts = s.split(/\n(?=-----BEGIN CERTIFICATE-----)/g).map(p => p.trim()).filter(Boolean);
      opts.ca = parts.length > 1 ? parts : [s];
    }
    if (typeof opts.cert === 'string') opts.cert = (opts.cert as string).trim() + (/(\n)$/.test(opts.cert as string) ? '' : '\n');
    if (typeof opts.key === 'string') opts.key = (opts.key as string).trim() + (/(\n)$/.test(opts.key as string) ? '' : '\n');
    // Force modern TLS
    (opts as any).minVersion = 'TLSv1.2';
    if (debugTls) {
      const caPreview = Array.isArray(opts.ca)
        ? `<arr:${(opts.ca as string[]).length}>`
        : typeof opts.ca === 'string'
          ? `<str:${(opts.ca as string).length}>`
          : undefined;
      const redacted = { ...opts, ca: caPreview, cert: typeof opts.cert === 'string' ? `<str:${(opts.cert as string).length}>` : undefined, key: typeof opts.key === 'string' ? `<str:${(opts.key as string).length}>` : undefined };
      console.log('[TLS] dockerode opts preview:', redacted);
      // Validate PEM shapes
      const validate = (label: string, s: string) => {
        const hasBegin = /-----BEGIN [A-Z ]+-----/.test(s);
        const hasEnd = /-----END [A-Z ]+-----/.test(s);
        const body = s.replace(/-----BEGIN [A-Z ]+-----/g, '').replace(/-----END [A-Z ]+-----/g, '').replace(/\s+/g, '');
        let ok = false;
        try { Buffer.from(body, 'base64'); ok = body.length > 0; } catch {}
        console.log(`[TLS] validate ${label}: begin=${hasBegin} end=${hasEnd} bodyLen=${body.length} ok=${ok}`);
      };
      if (Array.isArray(opts.ca)) (opts.ca as string[]).forEach((c, i) => validate(`ca[${i}]`, c));
      if (typeof opts.cert === 'string') validate('cert', opts.cert as string);
      if (typeof opts.key === 'string') validate('key', opts.key as string);
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

// Minimal TLS debug helper for an HTTP route
export async function debugDockerTls(): Promise<any> {
  const docker = getDocker();
  return await new Promise((resolve, reject) => {
    docker.version((err: any, info: any) => {
      if (err) return reject(err);
      resolve(info);
    });
  });
}


