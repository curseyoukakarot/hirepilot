import Docker from 'dockerode';
import { OrchestratorEngine, StartOpts, StartResult } from './engine';
import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';

function getDocker(): Docker {
  const dockerHost = process.env.DOCKER_HOST;
  if (dockerHost) {
    const tls = String(process.env.DOCKER_TLS_VERIFY || '').trim();
    const tlsEnabled = (tls === '1' || tls.toLowerCase() === 'true');
    // Debug env presence for key
    try {
      // eslint-disable-next-line no-console
      console.log('[DEBUG ENV] DOCKER_KEY_PEM_B64 exists:', !!process.env.DOCKER_KEY_PEM_B64, 'length:', process.env.DOCKER_KEY_PEM_B64?.length);
    } catch {}
    // Normalize DOCKER_HOST into discrete protocol/host/port for dockerode/docker-modem
    let normalizedUrl = dockerHost;
    if (/^tcp:\/\//i.test(normalizedUrl)) {
      normalizedUrl = normalizedUrl.replace(/^tcp:\/\//i, tlsEnabled ? 'https://' : 'http://');
    }
    // If no scheme provided, assume https when TLS enabled, else http
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = (tlsEnabled ? 'https://' : 'http://') + normalizedUrl;
    }
    let url: URL;
    try { url = new URL(normalizedUrl); } catch {
      // Fallback: assume host:port
      const [h, p] = normalizedUrl.split(':');
      url = new URL(`${tlsEnabled ? 'https' : 'http'}://${h}:${p || (tlsEnabled ? '2376' : '2375')}`);
    }
    const opts: any = {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port ? Number(url.port) : (tlsEnabled ? 2376 : 2375),
      servername: url.hostname
    };
    const debugTls = (() => { const v = String(process.env.DOCKER_TLS_DEBUG || '').toLowerCase(); return v === '1' || v === 'true'; })();
    if (debugTls) {
      console.log('[TLS] normalized DOCKER_HOST ->', { protocol: opts.protocol, host: opts.host, port: opts.port });
    }
    if (tlsEnabled) {
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
        return { ca, cert, key } as any;
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
      if (envPems?.ca) { opts.ca = envPems.ca; logPemPreview('env.ca', envPems.ca); }
      if (envPems?.cert) { opts.cert = envPems.cert; logPemPreview('env.cert', envPems.cert); }
      if (envPems?.key) { opts.key = envPems.key; logPemPreview('env.key', envPems.key); }

      // Optional: support PKCS#12 client bundle via env
      const p12B64 = process.env.DOCKER_CLIENT_P12_B64 || '';
      const p12Pass = process.env.DOCKER_CLIENT_P12_PASS ?? '';
      if (p12B64) {
        try {
          (opts as any).pfx = Buffer.from(p12B64, 'base64');
          // Always set passphrase property; empty string is valid for PKCS#12 with no password
          (opts as any).passphrase = p12Pass;
          delete opts.cert; delete opts.key; // avoid ambiguity
          if (debugTls) console.log('[TLS] using PFX bundle, len=', (opts as any).pfx.length, 'pass=', p12Pass ? 'yes' : 'no');
        } catch (e) {
          console.log('[TLS] failed to load P12 bundle:', (e as any)?.message);
        }
      }

      // Optional: write env certs to files and read from disk (control path)
      const writeFilesFlag = String(process.env.DOCKER_TLS_USE_CERT_PATH || '').toLowerCase();
      if (writeFilesFlag === '1' || writeFilesFlag === 'true') {
        try {
          const certDir = '/app/docker-certs';
          fs.mkdirSync(certDir, { recursive: true });
          const caB64 = process.env.DOCKER_CA_PEM_B64 || '';
          const certB64 = process.env.DOCKER_CERT_PEM_B64 || '';
          const keyB64 = process.env.DOCKER_KEY_PEM_B64 || '';
          if (caB64) fs.writeFileSync(`${certDir}/ca.pem`, Buffer.from(caB64, 'base64'));
          if (certB64) fs.writeFileSync(`${certDir}/cert.pem`, Buffer.from(certB64, 'base64'));
          if (keyB64) fs.writeFileSync(`${certDir}/key.pem`, Buffer.from(keyB64, 'base64'));
          try {
            const keyHead = fs.existsSync(`${certDir}/key.pem`) ? fs.readFileSync(`${certDir}/key.pem`, 'utf8').slice(0, 80) : 'missing';
            console.log('[TLS FILES] Wrote files; key head:', keyHead.replace(/\n/g, '\\n'));
          } catch {}
          // Prefer file-based for this control path
          const caPath = `${certDir}/ca.pem`;
          const certPath = `${certDir}/cert.pem`;
          const keyPath = `${certDir}/key.pem`;
          if (fs.existsSync(caPath)) opts.ca = fs.readFileSync(caPath);
          if (fs.existsSync(certPath)) opts.cert = fs.readFileSync(certPath);
          if (fs.existsSync(keyPath)) opts.key = fs.readFileSync(keyPath);
          // Remove PFX if set to avoid ambiguity
          delete (opts as any).pfx; delete (opts as any).passphrase;
        } catch (e) {
          console.log('[TLS FILES] Failed to write/read cert files:', (e as any)?.message);
        }
      }

      // If nothing from env, try file-based DOCKER_CERT_PATH
      if (!opts.ca && !opts.cert && !opts.key && !(opts as any).pfx) {
        const certDir = process.env.DOCKER_CERT_PATH || '';
        const caPath = path.join(certDir, 'ca.pem');
        const certPath = path.join(certDir, 'cert.pem');
        const keyPath = path.join(certDir, 'key.pem');
        if (fs.existsSync(caPath)) {
          opts.ca = fs.readFileSync(caPath); logPemPreview('file.ca', opts.ca);
        }
        if (fs.existsSync(certPath)) { opts.cert = fs.readFileSync(certPath); logPemPreview('file.cert', opts.cert); }
        if (fs.existsSync(keyPath)) { opts.key = fs.readFileSync(keyPath); logPemPreview('file.key', opts.key); }
        if (!opts.ca || (!((opts as any).pfx) && !(opts.cert && opts.key))) {
          throw new Error(`Docker TLS enabled but certs not found in env or ${certDir}. Expected ca.pem, cert.pem, key.pem or DOCKER_CLIENT_P12_B64`);
        }
      }
    }
    // (PFX also supported above inside TLS branch)

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
    // Convert CA strings to Buffers for Node TLS
    if (Array.isArray(opts.ca)) {
      opts.ca = (opts.ca as string[]).map((c) => Buffer.from(c, 'utf8'));
    }

    // Optional insecure toggle for debugging
    const insecure = String(process.env.DOCKER_TLS_INSECURE || '').toLowerCase();
    if (insecure === '1' || insecure === 'true') {
      (opts as any).rejectUnauthorized = false;
      (opts as any).checkServerIdentity = () => undefined;
    }

    if (debugTls) {
      const caPreview = Array.isArray(opts.ca)
        ? `<arr:${(opts.ca as string[]).length}>`
        : typeof opts.ca === 'string'
          ? `<str:${(opts.ca as string).length}>`
          : undefined;
      const redacted = { ...opts, ca: caPreview, cert: typeof opts.cert === 'string' ? `<str:${(opts.cert as string).length}>` : undefined, key: typeof opts.key === 'string' ? `<str:${(opts.key as string).length}>` : undefined };
      console.log('[TLS] dockerode opts preview:', redacted);
      // Log CA fingerprint(s) to compare with VM
      try {
        const crypto = require('node:crypto');
        const toSha256 = (b: Buffer) => (crypto as any).createHash('sha256').update(b).digest('hex');
        if (Array.isArray(opts.ca)) {
          (opts.ca as Buffer[]).forEach((b: Buffer, i: number) => console.log(`[TLS] ca[${i}] sha256=${toSha256(b)}`));
        }
      } catch {}
      // Validate PEM shapes
      const validate = (label: string, s: string) => {
        const hasBegin = /-----BEGIN [A-Z ]+-----/.test(s);
        const hasEnd = /-----END [A-Z ]+-----/.test(s);
        const body = s.replace(/-----BEGIN [A-Z ]+-----/g, '').replace(/-----END [A-Z ]+-----/g, '').replace(/\s+/g, '');
        let ok = false;
        try { Buffer.from(body, 'base64'); ok = body.length > 0; } catch {}
        console.log(`[TLS] validate ${label}: begin=${hasBegin} end=${hasEnd} bodyLen=${body.length} ok=${ok}`);
      };
      if (Array.isArray(opts.ca)) (opts.ca as any[]).forEach((c, i) => {
        const s = typeof c === 'string' ? (c as string) : Buffer.isBuffer(c) ? (c as Buffer).toString('utf8') : String(c);
        validate(`ca[${i}]`, s);
      });
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
    const requestedImage = process.env.LI_DOCKER_IMAGE || process.env.NOVNC_IMAGE || 'hirepilot/li-novnc:latest';
    // Ensure image exists (pull if needed)
    try { await (docker.getImage(requestedImage) as any).inspect(); } catch {
      await new Promise<void>((resolve, reject) => {
        docker.pull(requestedImage, (err: any, stream: any) => {
          if (err) return reject(err);
          (docker as any).modem.followProgress(stream, (pullErr: any) => pullErr ? reject(pullErr) : resolve());
        });
      });
    }

    const isBrowserless = /browserless\/chrome/i.test(requestedImage);

    // Optional: force published host port(s) into a specific range to ease firewall rules
    // e.g., LI_PUBLISH_PORT_RANGE="32000-32999"
    const range = String(process.env.LI_PUBLISH_PORT_RANGE || '').trim();
    const pickPortInRange = (): number | undefined => {
      if (!/^\d{2,5}-\d{2,5}$/.test(range)) return undefined;
      const [minS, maxS] = range.split('-');
      const min = parseInt(minS, 10);
      const max = parseInt(maxS, 10);
      if (Number.isNaN(min) || Number.isNaN(max) || min >= max) return undefined;
      // Simple deterministic pick based on session hash to spread
      const baseHash = Array.from(opts.sessionId).reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
      const candidate = min + (baseHash % (max - min));
      return candidate;
    };
    const preferredPort = pickPortInRange();
    const preferredDebug = preferredPort ? Math.min(preferredPort + 1, 65535) : undefined;
    const containerConfig: any = {
      Image: requestedImage,
      Env: [
        `USER_DATA_DIR=/home/chrome/user-data-dir/${opts.sessionId}`,
        `SCREEN_GEOMETRY=1366x768x24`,
        ...(opts.proxyUrl ? [`HTTPS_PROXY=${opts.proxyUrl}`, `HTTP_PROXY=${opts.proxyUrl}`] : [])
      ],
      ExposedPorts: isBrowserless ? { '3000/tcp': {} } : { '8080/tcp': {}, '9222/tcp': {} },
      HostConfig: {
        PortBindings: isBrowserless
          ? { '3000/tcp': [{ HostPort: preferredPort ? String(preferredPort) : '' }] }
          : {
              '8080/tcp': [{ HostPort: process.env.NOVNC_PORT || '58080' }],
              '9222/tcp': [{ HostPort: process.env.CDP_PORT || '59222' }]
            }
      },
      Labels: { 'hp.sessionId': opts.sessionId }
    };
    // Do not override CMD for browserless/chrome; it manages Chrome internally.

    let container;
    try {
      container = await docker.createContainer(containerConfig);
      await container.start();
    } catch (e: any) {
      // If preferred port is taken, fall back to dynamic assignment once
      if (preferredPort && /address already in use|port is already allocated/i.test(String(e?.message || ''))) {
        const fallbackCfg = { ...containerConfig };
        if (isBrowserless) {
          fallbackCfg.HostConfig.PortBindings['3000/tcp'][0].HostPort = '';
        } else {
          fallbackCfg.HostConfig.PortBindings['8080/tcp'][0].HostPort = '';
          fallbackCfg.HostConfig.PortBindings['9222/tcp'][0].HostPort = '';
        }
        container = await docker.createContainer(fallbackCfg);
        await container.start();
      } else {
        throw e;
      }
    }
    const data = await container.inspect();

    const ports = (data as any)?.NetworkSettings?.Ports as any;
    const streamPort = isBrowserless ? ports?.['3000/tcp']?.[0]?.HostPort as string : ports?.['8080/tcp']?.[0]?.HostPort as string;
    const debugPort = isBrowserless ? streamPort : ports?.['9222/tcp']?.[0]?.HostPort as string;

    // Choose the public base used by the frontend iframe to reach the container
    // Priority:
    // 1) STREAM_PUBLIC_BASE_URL (explicit app domain/path if reverse-proxied)
    // 2) DOCKER_PUBLIC_BASE_URL (public base of the remote Docker host, e.g. http://<VM_IP>)
    // 3) Derived from DOCKER_HOST (fall back to http://<host-from-DOCKER_HOST>)
    const dockerHostEnv = process.env.DOCKER_HOST || '';
    const parsedDockerHost = (() => {
      try {
        const norm = dockerHostEnv.startsWith('tcp://') ? dockerHostEnv.replace(/^tcp:\/\//i, 'https://') : dockerHostEnv;
        const u = new URL(norm);
        return u.hostname || '';
      } catch { return ''; }
    })();
    const publicBaseRaw = (process.env.STREAM_PUBLIC_BASE_URL || process.env.DOCKER_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    // Best-effort: open LinkedIn login automatically via CDP
    try {
      const wsUrl = `ws://localhost:${debugPort}/devtools/browser`;
      const ws = new WebSocket(wsUrl);
      await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); setTimeout(()=>rej(new Error('CDP open timeout')), 5000); });
      const cdpSend = (id: number, method: string, params: any = {}) => new Promise<any>((resolve, reject) => {
        const onMsg = (raw: WebSocket.RawData) => {
          try { const msg = JSON.parse(raw.toString()); if (msg.id === id) { ws.off('message', onMsg); resolve(msg.result); } } catch {}
        };
        ws.on('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
        setTimeout(() => { ws.off('message', onMsg); reject(new Error('CDP rpc timeout')); }, 5000);
      });
      await cdpSend(1, 'Target.createTarget', { url: 'https://www.linkedin.com/login' });
      ws.close();
    } catch { /* non-fatal */ }

    const streamUrl = (() => {
      const base = String(process.env.STREAM_PUBLIC_BASE_URL || '').replace(/\/$/, '');
      if (base) return `${base}/vnc.html?autoconnect=1&resize=scale`;
      if (process.env.DOCKER_PUBLIC_BASE_URL) return `${publicBaseRaw}:${streamPort}/vnc.html?autoconnect=1&resize=scale`;
      if (parsedDockerHost) return `http://${parsedDockerHost}:${streamPort}/vnc.html?autoconnect=1&resize=scale`;
      return `http://localhost:${streamPort}/vnc.html?autoconnect=1&resize=scale`;
    })();

    return {
      containerId: container.id,
      streamUrl,
      remoteDebugUrl: `ws://localhost:${process.env.CDP_PORT || '59222'}/devtools/browser`
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


