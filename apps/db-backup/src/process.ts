import { spawn, type ChildProcess } from 'child_process';
import { BackupError, type BackupFailureStep } from './types';
import { redactError } from './redact';

export type SpawnedProcess = {
  child: ChildProcess;
  done: Promise<{ stdout: string; stderr: string; code: number }>;
};

export function spawnCaptured(
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    track?: Set<ChildProcess>;
  } = {},
): SpawnedProcess {
  const child = spawn(command, args, {
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  options.track?.add(child);

  const done = new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', (error) => {
      options.track?.delete(child);
      reject(error);
    });
    child.on('close', (code) => {
      options.track?.delete(child);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        code: code ?? 1,
      });
    });
  });

  return { child, done };
}

export function killTracked(processes: Set<ChildProcess>): void {
  for (const child of processes) {
    if (child.killed || child.exitCode !== null) {
      continue;
    }
    try {
      child.kill('SIGTERM');
    } catch {
      // Process already gone.
    }
    const pid = child.pid;
    if (pid) {
      setTimeout(() => {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // Already exited.
        }
      }, 1500).unref();
    }
  }
  processes.clear();
}

export async function runCommand(params: {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  step: BackupFailureStep;
  failureMessage: string;
  track?: Set<ChildProcess>;
}): Promise<{ stdout: string; stderr: string }> {
  let spawned: SpawnedProcess;
  try {
    spawned = spawnCaptured(params.command, params.args, {
      env: params.env,
      track: params.track,
    });
  } catch (error) {
    throw new BackupError(params.step, `${params.failureMessage}: ${redactError(error)}`);
  }

  const result = await spawned.done;
  if (result.code !== 0) {
    throw new BackupError(
      params.step,
      `${params.failureMessage} (exit ${result.code}): ${redactError(result.stderr || result.stdout || 'no output')}`,
    );
  }
  return { stdout: result.stdout, stderr: result.stderr };
}

export function parsePostgresMajor(versionText: string): number | null {
  const match = versionText.match(/(\d+)\.\d+/);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}
