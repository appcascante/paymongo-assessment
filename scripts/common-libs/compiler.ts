import { execFileSync } from 'child_process';
import { mkdir, rm, writeFile } from 'fs/promises';
import { randomBytes } from 'crypto';
import path from 'path';
import { readProcessError } from './utils';

/**
 * Writes generated TypeScript to a temporary file inside the real runnable test directory and invokes the local
 * TypeScript compiler with strict settings so bad imports, syntax errors, and unsafe output are rejected before the
 * spec is committed to disk.
 *
 * The candidate is placed inside `runnableDir` (e.g. `<repoRoot>/tests/api/`) so any relative imports the generated
 * spec uses (such as `../../utils/schema-validator`) resolve exactly the way they will at runtime, and so node module
 * resolution finds `node_modules` at the repository root. The filename ends in `.tscheck.ts` (not `.spec.ts`) so
 * Playwright's `testMatch` patterns ignore it even if a generation run overlaps a test run.
 *
 * Each invocation gets its own random suffix so concurrent generators (multiple endpoints compiled in parallel) do
 * not race on file writes or directory cleanup.
 */
export async function compileGeneratedCode(
    code: string,
    repoRoot: string,
    runnableDir: string
): Promise<void> {
    const uniqueSuffix = `${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const candidateFileName = `.tsc-candidate-${uniqueSuffix}.tscheck.ts`;
    const candidatePath = path.join(runnableDir, candidateFileName);
    const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    await mkdir(runnableDir, { recursive: true });
    await writeFile(candidatePath, `${code}\n`, 'utf8');

    try {
        execFileSync(
            npxCommand,
            [
                'tsc',
                '--noEmit',
                '--pretty',
                'false',
                '--strict',
                '--target',
                'ES2020',
                '--module',
                'CommonJS',
                '--moduleResolution',
                'node',
                '--esModuleInterop',
                '--skipLibCheck',
                candidatePath,
            ],
            { cwd: repoRoot, stdio: 'pipe', shell: process.platform === 'win32' }
        );
    } catch (error) {
        throw new Error(`TypeScript compile check failed: ${readProcessError(error)}`);
    } finally {
        await rm(candidatePath, { force: true });
    }
}
