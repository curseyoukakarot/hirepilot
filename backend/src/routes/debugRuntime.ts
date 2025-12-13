import { execSync } from 'child_process';
import { Router } from 'express';

const router = Router();

router.get('/_debug/runtime', async (_req, res) => {
  const safeExec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: 'utf8' }).trim();
    } catch (e: any) {
      return `ERROR: ${e?.message || 'unknown'}`;
    }
  };

  res.json({
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    osRelease: safeExec('cat /etc/os-release'),
    uname: safeExec('uname -a'),
    playwrightLibs: {
      libnss3: safeExec('ls -la /usr/lib/x86_64-linux-gnu/libnss3.so*'),
      libglib: safeExec('ls -la /usr/lib/x86_64-linux-gnu/libglib-2.0.so*'),
      libx11: safeExec('ls -la /usr/lib/x86_64-linux-gnu/libX11.so*'),
      libgbm: safeExec('ls -la /usr/lib/x86_64-linux-gnu/libgbm.so*'),
      libasound: safeExec('ls -la /usr/lib/x86_64-linux-gnu/libasound.so*'),
    },
    playwrightBrowsers: safeExec('npx playwright install --dry-run || true'),
    dockerHint: safeExec('cat /proc/1/cgroup || true'),
  });
});

export default router;
