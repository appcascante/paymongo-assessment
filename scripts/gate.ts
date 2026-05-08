/**
 * Quality gate orchestrator: boots the app servers, regenerates LLM-authored tests, runs the full Playwright suite
 * (API + web), and tears the servers down regardless of test outcome. Exits with the Playwright test exit code so CI
 * can use this single entry point as the PR quality gate.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

/**
 * Runs an npm script synchronously, streaming output to the console, and returns the exit code so the gate can
 * decide whether to short-circuit or always run the cleanup step.
 */
function runStep(label: string, script: string): number {
    console.log(`\n[gate] === ${label} ===`);
    const result = spawnSync(npmCommand, ['run', script], {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: isWindows,
        env: { ...process.env, PW_TEST_HTML_REPORT_OPEN: 'never', PLAYWRIGHT_HTML_OPEN: 'never' },
    });
    return result.status ?? 1;
}

const startCode = runStep('Start app servers', 'app:start');
if (startCode !== 0) {
    console.error('[gate] Failed to start app servers; aborting.');
    runStep('Stop app servers', 'app:stop');
    process.exit(startCode);
}

const generateCode = runStep('Generate LLM tests', 'generate');
if (generateCode !== 0) {
    console.error('[gate] Test generation failed; tearing down.');
    runStep('Stop app servers', 'app:stop');
    process.exit(generateCode);
}

const testCode = runStep('Run Playwright suite', 'test');
runStep('Stop app servers', 'app:stop');
process.exit(testCode);
