import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { CacheEntry } from './types';

export interface WriteSpecArgs {
    code: string;
    fileName: string;
    generatedTestDir: string;
    runnableTestDir: string;
    modelName: string;
}

/**
 * Writes the accepted generated spec into the submission archive directory and copies the same file into the runnable
 * Playwright test tree so the untouched template config can discover and run it.
 */
export async function writeGeneratedSpec(args: WriteSpecArgs): Promise<CacheEntry> {
    const generatedTestPath = path.join(args.generatedTestDir, args.fileName);
    const runnableTestPath = path.join(args.runnableTestDir, args.fileName);

    await mkdir(args.generatedTestDir, { recursive: true });
    await mkdir(args.runnableTestDir, { recursive: true });
    await writeFile(generatedTestPath, `${args.code}\n`, 'utf8');
    await writeFile(runnableTestPath, `${args.code}\n`, 'utf8');

    return {
        hash: '',
        modelName: args.modelName,
        generatedTestPath,
        runnableTestPath,
        generatedAt: new Date().toISOString(),
    };
}
