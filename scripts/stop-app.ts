/**
 * Reads the PID file written by start-app.ts and terminates the backend and frontend process trees. On Windows the
 * tree is killed with taskkill so child Node and Go workers do not leak; on POSIX the negative PID kills the process
 * group.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..');
const pidFile = join(repoRoot, 'scripts', '.app-pids.json');
const isWindows = process.platform === 'win32';

interface PidFile {
    backendPid: number | null;
    frontendPid: number | null;
    preexisting?: boolean;
}

/**
 * Kills a single PID along with its descendants so background `next dev` workers and Go child processes do not
 * survive the stop step.
 */
function killTree(pid: number | null, label: string): void {
    if (!pid) return;
    try {
        if (isWindows) {
            spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' });
        } else {
            try { process.kill(-pid, 'SIGTERM'); } catch { process.kill(pid, 'SIGTERM'); }
        }
        console.log(`[stop-app] Sent termination signal to ${label} (pid ${pid}).`);
    } catch (error: unknown) {
        console.warn(`[stop-app] Could not stop ${label} (pid ${pid}): ${error instanceof Error ? error.message : String(error)}`);
    }
}

if (!existsSync(pidFile)) {
    console.log('[stop-app] No PID file found; nothing to stop.');
    process.exit(0);
}

const pids = JSON.parse(readFileSync(pidFile, 'utf8')) as PidFile;
killTree(pids.frontendPid, 'frontend');
killTree(pids.backendPid, 'backend');
rmSync(pidFile, { force: true });
console.log('[stop-app] Done.');
