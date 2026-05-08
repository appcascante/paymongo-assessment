import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildRetryPrompt, stripCodeFence } from './prompt';

export type GeminiModel = ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

export interface GeminiModelOptions {
    modelName: string;
    apiKeyMissingMessage?: string;
}

/**
 * Creates a configured Gemini model lazily so fully cached generator runs do not require an API key.
 */
export function createGeminiModel(options: GeminiModelOptions): GeminiModel {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(options.apiKeyMissingMessage || 'GEMINI_API_KEY is required to call the Gemini API.');
    }

    return new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: options.modelName,
        generationConfig: {
            temperature: 0,
            topP: 0,
        },
    });
}

/**
 * Asks Gemini for one spec and returns the raw generated TypeScript after removing optional markdown fences.
 * Retries on transient errors (HTTP 429 rate limit, 5xx, network) with exponential backoff and jitter so a parallel
 * generator run does not fail the whole pipeline on a brief throttle.
 */
export async function generateCandidate(model: GeminiModel, prompt: string): Promise<string> {
    const maxAttempts = Number.parseInt(process.env.GEMINI_MAX_ATTEMPTS || '5', 10);
    const baseDelayMs = Number.parseInt(process.env.GEMINI_BACKOFF_BASE_MS || '1000', 10);

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const result = await model.generateContent(prompt);
            return stripCodeFence(result.response.text());
        } catch (error) {
            lastError = error;
            if (!isRetryableError(error) || attempt === maxAttempts) {
                throw error;
            }
            const jitter = Math.floor(Math.random() * baseDelayMs);
            const delayMs = baseDelayMs * 2 ** (attempt - 1) + jitter;
            console.warn(
                `Gemini call failed (attempt ${attempt}/${maxAttempts}); retrying in ${delayMs}ms: ${readErrorMessage(error)}`
            );
            await sleep(delayMs);
        }
    }

    // Unreachable: the loop either returns or throws above.
    throw lastError instanceof Error ? lastError : new Error('Gemini retry loop exited unexpectedly.');
}

/**
 * Returns true for HTTP 429 (rate limit), HTTP 5xx, and common transient network errors so generateCandidate
 * retries them but still surfaces 4xx (other than 429) and code-level bugs immediately.
 */
function isRetryableError(error: unknown): boolean {
    const message = readErrorMessage(error).toLowerCase();
    if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
        return true;
    }
    if (/\b5\d{2}\b/.test(message)) {
        return true;
    }
    return ['econnreset', 'etimedout', 'enotfound', 'eai_again', 'fetch failed', 'network'].some((token) =>
        message.includes(token)
    );
}

/**
 * Extracts a human-readable message from an unknown error without throwing.
 */
function readErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ValidatedGenerationOptions {
    model: GeminiModel;
    prompt: string;
    maxRetries: number;
    label: string;
    validate: (code: string) => Promise<string[]>;
}

/**
 * Runs Gemini generation with a bounded repair loop, validating each candidate via the provided validator before
 * accepting it. The validator returns an array of human-readable error messages; an empty array means success.
 */
export async function generateValidatedCode(options: ValidatedGenerationOptions): Promise<string> {
    const { model, prompt, maxRetries, label, validate } = options;
    const totalAttempts = maxRetries + 1;
    let currentPrompt = prompt;

    for (let attemptNumber = 1; attemptNumber <= totalAttempts; attemptNumber += 1) {
        const code = await generateCandidate(model, currentPrompt);
        const validationErrors = await validate(code);

        if (validationErrors.length === 0) {
            return code;
        }

        if (attemptNumber === totalAttempts) {
            throw new Error(
                `Gemini output for ${label} failed validation after ${totalAttempts} attempts:\n${validationErrors.join('\n')}`
            );
        }

        currentPrompt = buildRetryPrompt(prompt, attemptNumber, validationErrors);
    }

    throw new Error('Unexpected generator retry loop exit.');
}
