import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { isRecord } from './utils';
import type { CacheEntry, CacheFile } from './types';

/**
 * Reads the existing generator cache when present and falls back to an empty cache shape when the file is missing or
 * malformed. The cache namespaces both `api` and `web` so each generator preserves the other's section on write.
 */
export async function readCache(cachePath: string): Promise<CacheFile> {
    if (!existsSync(cachePath)) {
        return { api: {}, web: {} };
    }

    const fileContent = await readFile(cachePath, 'utf8');
    const parsed: unknown = JSON.parse(fileContent);
    if (!isRecord(parsed)) {
        return { api: {}, web: {} };
    }

    const api = isRecord(parsed.api) ? (parsed.api as Record<string, CacheEntry>) : {};
    const web = isRecord(parsed.web) ? (parsed.web as Record<string, CacheEntry>) : {};
    return { api, web };
}

/**
 * Writes the generator cache using stable formatting so cache diffs remain readable during review.
 */
export async function writeCache(cachePath: string, cache: CacheFile): Promise<void> {
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

/**
 * Determines whether a generator run can be skipped because the prompt hash is unchanged and both output files are
 * still present on disk.
 */
export function shouldSkip(cacheEntry: CacheEntry | undefined, promptHash: string): boolean {
    return Boolean(
        cacheEntry &&
            cacheEntry.hash === promptHash &&
            typeof cacheEntry.generatedTestPath === 'string' &&
            existsSync(cacheEntry.generatedTestPath) &&
            typeof cacheEntry.runnableTestPath === 'string' &&
            existsSync(cacheEntry.runnableTestPath)
    );
}
