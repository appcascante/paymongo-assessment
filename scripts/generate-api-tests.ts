import path from 'path';
import { readFile } from 'fs/promises';
import * as dotenv from 'dotenv';

import { readCache, writeCache, shouldSkip } from './common-libs/cache';
import { mapWithConcurrency } from './common-libs/concurrency';
import { createGeminiModel, generateValidatedCode, type GeminiModel } from './common-libs/gemini';
import { createHashValue } from './common-libs/prompt';
import { formatUnknownError } from './common-libs/utils';
import { writeGeneratedSpec } from './common-libs/writer';
import type { CacheEntry } from './common-libs/types';

import { createConfig } from './generate-api-libs/config';
import { buildPrompt } from './generate-api-libs/prompt';
import { extractEndpoints, parseSwaggerSpec, readJsonFile } from './generate-api-libs/swagger';
import { validateGeneratedCode } from './generate-api-libs/validation';
import type { EndpointContext } from './generate-api-libs/types';

interface EndpointJob {
    endpoint: EndpointContext;
    cacheKey: string;
    prompt: string;
    promptHash: string;
    cached: CacheEntry | undefined;
}

interface JobResult {
    cacheKey: string;
    skipped: boolean;
    cacheEntry: CacheEntry | undefined;
}

/**
 * Coordinates Swagger parsing, endpoint prompt creation, cache checks, Gemini generation, validation, and disk writes
 * for all API operations in the app under test. Endpoints are processed in parallel up to GENERATOR_CONCURRENCY
 * (default 4) so a Swagger file with many endpoints regenerates quickly without exhausting Gemini rate limits.
 */
async function generateApiTests(): Promise<void> {
    const repoRoot = path.resolve(__dirname, '..');
    dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });

    const config = createConfig(repoRoot);

    const promptTemplate = await readFile(config.promptTemplatePath, 'utf8');
    const swagger = parseSwaggerSpec(await readJsonFile(config.swaggerPath));
    const endpoints = extractEndpoints(swagger);
    const allowedPaths = new Set(Object.keys(swagger.paths));
    const cache = await readCache(config.cachePath);
    const concurrency = Math.max(1, Number.parseInt(process.env.GENERATOR_CONCURRENCY || '1', 10));

    if (endpoints.length === 0) {
        throw new Error('No supported API endpoints were found in the Swagger file.');
    }

    const jobs: EndpointJob[] = endpoints.map((endpoint) => {
        const cacheKey = `${endpoint.method.toUpperCase()} ${endpoint.pathName}`;
        const prompt = buildPrompt(promptTemplate, swagger, endpoint);
        const promptHash = createHashValue(`${config.modelName}\n${prompt}`);
        return { endpoint, cacheKey, prompt, promptHash, cached: cache.api[cacheKey] };
    });

    // Lazily create the model only if at least one job is a cache miss.
    const hasCacheMiss = jobs.some((job) => !shouldSkip(job.cached, job.promptHash));
    const model: GeminiModel | undefined = hasCacheMiss
        ? createGeminiModel({
              modelName: config.modelName,
              apiKeyMissingMessage: 'GEMINI_API_KEY is required to generate uncached API tests.',
          })
        : undefined;

    const results = await mapWithConcurrency(jobs, concurrency, async (job): Promise<JobResult> => {
        if (shouldSkip(job.cached, job.promptHash)) {
            console.log(`Skipped unchanged ${job.cacheKey}`);
            return { cacheKey: job.cacheKey, skipped: true, cacheEntry: undefined };
        }

        if (!model) {
            throw new Error('Gemini model is not initialized despite a cache miss.');
        }

        console.log(`Generating ${job.cacheKey}`);
        const code = await generateValidatedCode({
            model,
            prompt: job.prompt,
            maxRetries: config.maxRetries,
            label: job.cacheKey,
            validate: (candidate) => validateGeneratedCode(candidate, job.endpoint, allowedPaths, config),
        });
        const cacheEntry = await writeGeneratedSpec({
            code,
            fileName: job.endpoint.fileName,
            generatedTestDir: config.generatedTestDir,
            runnableTestDir: config.runnableTestDir,
            modelName: config.modelName,
        });
        return {
            cacheKey: job.cacheKey,
            skipped: false,
            cacheEntry: { ...cacheEntry, hash: job.promptHash },
        };
    });

    let generatedCount = 0;
    let skippedCount = 0;
    for (const result of results) {
        if (result.skipped) {
            skippedCount += 1;
            continue;
        }
        if (result.cacheEntry) {
            cache.api[result.cacheKey] = result.cacheEntry;
            generatedCount += 1;
        }
    }

    await writeCache(config.cachePath, cache);
    console.log(
        `API generation complete. Generated: ${generatedCount}. Skipped: ${skippedCount}. Concurrency: ${concurrency}.`
    );
}

/**
 * Reports fatal generator errors with a non-zero exit code so CI and local scripts fail clearly.
 */
function reportFatalError(error: unknown): void {
    console.error(formatUnknownError(error));
    process.exitCode = 1;
}

void generateApiTests().catch(reportFatalError);
