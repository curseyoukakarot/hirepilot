import { spawn } from 'child_process';
import { logger } from '../lib/logger';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCommand(
  cmd: string,
  args: string[],
  cwd: string
): Promise<CommandResult> {
  logger.debug?.(`[repoAgent][commandRunner] ${cmd} ${args.join(' ')} (cwd=${cwd})`);

  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', (error) => {
      logger.error(
        { error, cmd, args, cwd },
        '[repoAgent][commandRunner] Failed to start command'
      );
      reject(error);
    });

    child.once('close', (code) => {
      const result: CommandResult = {
        exitCode: typeof code === 'number' ? code : -1,
        stdout,
        stderr,
      };

      if (code !== 0) {
        logger.warn(
          { cmd, args, cwd, exitCode: code, stderr: stderr.slice(-2000) },
          '[repoAgent][commandRunner] Command exited with non-zero status'
        );
      }

      resolve(result);
    });
  });
}

