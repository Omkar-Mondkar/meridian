import { Client, ConnectConfig } from 'ssh2';

export interface SshConfig {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey';
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface SshExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
  timedOut?: boolean;
}

export interface SshHandshakeResult {
  success: boolean;
  latencyMs: number;
  serverBanner?: string;
  error?: string;
}

/**
 * Builds ssh2 ConnectConfig from application SshConfig.
 */
function buildConnectConfig(config: SshConfig, readyTimeoutMs: number): ConnectConfig {
  const connConfig: ConnectConfig = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    readyTimeout: readyTimeoutMs,
    keepaliveInterval: 10000
  };

  if (config.authType === 'password') {
    connConfig.password = config.password || '';
  } else if (config.authType === 'privateKey') {
    if (config.privateKey) {
      connConfig.privateKey = config.privateKey;
    }
    if (config.passphrase) {
      connConfig.passphrase = config.passphrase;
    }
  }

  return connConfig;
}

/**
 * Tests reachability and authentication against the target SSH host.
 * Timeout default: 5000ms.
 */
export async function testSshConnection(
  config: SshConfig,
  timeoutMs = 5000
): Promise<SshHandshakeResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let resolved = false;
    const client = new Client();

    const finish = (result: SshHandshakeResult) => {
      if (resolved) return;
      resolved = true;
      try {
        client.end();
      } catch {
        // ignore close errors
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        success: false,
        latencyMs: Date.now() - startTime,
        error: `SSH handshake timed out after ${timeoutMs}ms`
      });
    }, timeoutMs);

    client.on('ready', () => {
      clearTimeout(timer);
      const latencyMs = Date.now() - startTime;
      finish({
        success: true,
        latencyMs
      });
    });

    client.on('banner', (message: string) => {
      // capture banner if server emits one
      if (typeof message === 'string') {
        // keep message available if needed
      }
    });

    client.on('error', (err: Error) => {
      clearTimeout(timer);
      finish({
        success: false,
        latencyMs: Date.now() - startTime,
        error: err.message || 'SSH connection error'
      });
    });

    try {
      const connConfig = buildConnectConfig(config, timeoutMs);
      client.connect(connConfig);
    } catch (err: unknown) {
      clearTimeout(timer);
      const errMsg = err instanceof Error ? err.message : String(err);
      finish({
        success: false,
        latencyMs: Date.now() - startTime,
        error: `SSH configuration error: ${errMsg}`
      });
    }
  });
}

/**
 * Executes a remote command on the centralized server via SSH.
 * Collects stdout, stderr, and exitCode with an 8000ms hard timeout.
 */
export async function executeSshCommand(
  config: SshConfig,
  command: string,
  timeoutMs = 8000
): Promise<SshExecutionResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let resolved = false;
    let timedOut = false;
    const client = new Client();

    const finish = (result: SshExecutionResult) => {
      if (resolved) return;
      resolved = true;
      try {
        client.end();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        client.destroy();
      } catch {
        // ignore
      }
      finish({
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: `Execution timed out after ${timeoutMs}ms`,
        executionTimeMs: Date.now() - startTime,
        timedOut: true,
        error: `Command execution exceeded ${timeoutMs}ms timeout`
      });
    }, timeoutMs);

    client.on('ready', () => {
      client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          return finish({
            success: false,
            exitCode: -1,
            stdout: '',
            stderr: err.message,
            executionTimeMs: Date.now() - startTime,
            error: err.message
          });
        }

        let stdoutBuffer = '';
        let stderrBuffer = '';
        let exitCode: number | null = null;

        stream.on('close', (code: number) => {
          clearTimeout(timer);
          exitCode = typeof code === 'number' ? code : 0;
          const executionTimeMs = Date.now() - startTime;
          finish({
            success: exitCode === 0,
            exitCode,
            stdout: stdoutBuffer.trim(),
            stderr: stderrBuffer.trim(),
            executionTimeMs
          });
        });

        stream.on('data', (data: Buffer) => {
          stdoutBuffer += data.toString('utf-8');
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderrBuffer += data.toString('utf-8');
        });
      });
    });

    client.on('error', (err: Error) => {
      if (timedOut) return;
      clearTimeout(timer);
      finish({
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: err.message || 'SSH connection error',
        executionTimeMs: Date.now() - startTime,
        error: err.message || 'SSH connection error'
      });
    });

    try {
      const connConfig = buildConnectConfig(config, timeoutMs);
      client.connect(connConfig);
    } catch (err: unknown) {
      clearTimeout(timer);
      const errMsg = err instanceof Error ? err.message : String(err);
      finish({
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: errMsg,
        executionTimeMs: Date.now() - startTime,
        error: errMsg
      });
    }
  });
}
