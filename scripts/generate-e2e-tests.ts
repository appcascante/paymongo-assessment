import path from 'path';
import { readFile } from 'fs/promises';
import * as dotenv from 'dotenv';

import { readCache, writeCache, shouldSkip } from './common-libs/cache';
import { createGeminiModel, generateValidatedCode } from './common-libs/gemini';
import { createHashValue, fillPromptTemplate } from './common-libs/prompt';
import { formatUnknownError } from './common-libs/utils';
import { writeGeneratedSpec } from './common-libs/writer';

import { createConfig, KNOWN_FACTS } from './generate-e2e-libs/config';
import { extractSelectors } from './generate-e2e-libs/selectors';
import { validateGeneratedCode } from './generate-e2e-libs/validation';

/**
 * Coordinates frontend selector extraction, prompt assembly, cache checks, Gemini generation, validation, and disk
 * writes for the checkout E2E spec.
 */
async function generateE2ETests(): Promise<void> {
    const repoRoot = path.resolve(__dirname, '..');
    dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });

    const config = createConfig(repoRoot);
    const promptTemplate = await readFile(config.promptTemplatePath, 'utf8');
    const pageSource = await readFile(config.pageSourcePath, 'utf8');
    const selectors = extractSelectors(pageSource);

    const prompt = fillPromptTemplate(promptTemplate, {
        '{{KNOWN_FACTS}}': KNOWN_FACTS,
        '{{SELECTORS_JSON}}': JSON.stringify(selectors, null, 2),
    });
    const promptHash = createHashValue(`${config.modelName}\n${prompt}`);
    const cache = await readCache(config.cachePath);
    const cacheKey = 'checkout';
    const cachedEntry = cache.web[cacheKey];

    if (shouldSkip(cachedEntry, promptHash)) {
        console.log(`Skipped unchanged E2E spec ${cacheKey}`);
        await writeCache(config.cachePath, cache);
        console.log('E2E generation complete. Generated: 0. Skipped: 1.');
        return;
    }

    const model = createGeminiModel({
        modelName: config.modelName,
        apiKeyMissingMessage: 'GEMINI_API_KEY is required to generate uncached E2E tests.',
    });

    console.log(`Generating E2E spec ${cacheKey}`);
    const code = await generateValidatedCode({
        model,
        prompt,
        maxRetries: config.maxRetries,
        label: `E2E ${cacheKey}`,
        validate: (candidate) => validateGeneratedCode(candidate, selectors, config),
    });

    const cacheEntry = await writeGeneratedSpec({
        code,
        fileName: config.generatedFileName,
        generatedTestDir: config.generatedTestDir,
        runnableTestDir: config.runnableTestDir,
        modelName: config.modelName,
    });
    cache.web[cacheKey] = { ...cacheEntry, hash: promptHash };
    await writeCache(config.cachePath, cache);
    console.log('E2E generation complete. Generated: 1. Skipped: 0.');
}

/**
 * Reports fatal generator errors with a non-zero exit code so CI and local scripts fail clearly.
 */
function reportFatalError(error: unknown): void {
    console.error(formatUnknownError(error));
    process.exitCode = 1;
}

void generateE2ETests().catch(reportFatalError);
