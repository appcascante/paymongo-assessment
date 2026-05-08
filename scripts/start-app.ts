/**
 * Boots the Go backend (`:8080`) and the Next.js frontend (`:3000`) in detached background processes, polls their
 * health endpoints, and exits 0 once both report ready. Designed to run before `playwright test` since
 * `playwright.config.ts` is not allowed to be modified to use Playwright's webServer hook directly.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import * as dotenv from 'dotenv';

const repoRoot = resolve(__dirname, '..');
dotenv.config({ path: join(repoRoot, '.env'), quiet: true });
const appCodeDir = process.env.APP_CODE_DIR ? resolve(process.env.APP_CODE_DIR) : resolve(repoRoot, '..', 'paymongo-assessment-app-code');
const logsDir = join(repoRoot, 'scripts', '.app-logs');
const pidFile = join(repoRoot, 'scripts', '.app-pids.json');
const backendUrl = process.env.STAGING_API_URL ?? 'http://localhost:8080';
const frontendUrl = process.env.STAGING_BASE_URL ?? 'http://localhost:3000';
const readyTimeoutMs = Number(process.env.APP_READY_TIMEOUT_MS ?? 180000);
const pollIntervalMs = 1000;
const isWindows = process.platform === 'win32';

/**
 * Starts a child process detached from the current shell so it survives this script's exit, and routes its stdout
 * and stderr into log files for post-mortem inspection without polluting the foreground console.
 */
function spawnDetached(label: string, command: string, args: string[], cwd: string): number | undefined {
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
    const out = openSync(join(logsDir, `${label}.log`), 'a');
    const err = openSync(join(logsDir, `${label}.err.log`), 'a');
    const child = spawn(command, args, {
        cwd,
        detached: true,
        stdio: ['ignore', out, err],
        shell: isWindows,
        env: process.env,
    });
    child.unref();
    return child.pid;
}

/**
 * Polls a URL with GET semantics until it returns any HTTP response, or until the timeout elapses, so we know
 * the server is at least accepting connections before Playwright begins.
 */
async function waitForUrl(url: string, label: string): Promise<void> {
    const deadline = Date.now() + readyTimeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, { method: 'GET' });
            if (response.status > 0) {
                console.log(`[start-app] ${label} ready (HTTP ${response.status}) at ${url}`);
                return;
            }
        } catch {
            // Server not up yet; keep polling until deadline.
        }
        await sleep(pollIntervalMs);
    }
    throw new Error(`[start-app] ${label} did not become ready at ${url} within ${readyTimeoutMs}ms`);
}

/**
 * Probes a URL once with a short timeout to determine whether a server is already running, so re-running the gate
 * does not double-start servers when one is already healthy from a previous invocation.
 */
async function isAlreadyHealthy(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), 1500);
        const response = await fetch(url, { method: 'GET', signal: controller.signal });
        clearTimeout(abortTimer);
        return response.status > 0;
    } catch {
        return false;
    }
}

/**
 * Spawns both servers, persists their PIDs for the matching stop script, and waits for both to respond before
 * returning success.
 */
async function main(): Promise<void> {
    if (!existsSync(appCodeDir)) {
        throw new Error(`[start-app] paymongo-assessment-app-code directory not found at ${appCodeDir}`);
    }

    const backendHealthy = await isAlreadyHealthy(`${backendUrl}/api/health`);
    const frontendHealthy = await isAlreadyHealthy(frontendUrl);

    if (backendHealthy && frontendHealthy) {
        console.log('[start-app] Both servers already healthy; nothing to start.');
        writeFileSync(pidFile, JSON.stringify({ backendPid: null, frontendPid: null, startedAt: new Date().toISOString(), preexisting: true }, null, 2));
        return;
    }

    console.log(`[start-app] Booting ${backendHealthy ? '' : 'backend '}${frontendHealthy ? '' : 'frontend '}in ${appCodeDir}`);

    const backendPid = backendHealthy ? null : spawnDetached('backend', 'go', ['run', 'main.go'], appCodeDir);
    const frontendPid = frontendHealthy ? null : spawnDetached('frontend', isWindows ? 'npm.cmd' : 'npm', ['run', 'dev'], appCodeDir);

    writeFileSync(pidFile, JSON.stringify({ backendPid, frontendPid, startedAt: new Date().toISOString() }, null, 2));

    await Promise.all([
        waitForUrl(`${backendUrl}/api/health`, 'backend'),
        waitForUrl(frontendUrl, 'frontend'),
    ]);

    console.log('[start-app] Both servers are ready.');
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
