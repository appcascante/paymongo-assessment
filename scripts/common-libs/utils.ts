/**
 * Determines whether a value is a non-array object, which allows safe property inspection on unknown JSON data.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Produces a readable message from unknown caught errors without using unsafe casts or assuming Error instances.
 */
export function formatUnknownError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Converts process output buffers or strings into UTF-8 text while safely ignoring unexpected output shapes.
 */
export function processOutputToString(output: unknown): string {
    if (typeof output === 'string') {
        return output;
    }

    if (Buffer.isBuffer(output)) {
        return output.toString('utf8');
    }

    return '';
}

/**
 * Reads stdout and stderr from a failed child process in a type-safe way, producing concise feedback for retry
 * prompts and terminal output.
 */
export function readProcessError(error: unknown): string {
    if (!isRecord(error)) {
        return formatUnknownError(error);
    }

    const stdout = processOutputToString(error.stdout);
    const stderr = processOutputToString(error.stderr);
    const combinedOutput = [stdout, stderr].filter(Boolean).join('\n').trim();
    return combinedOutput || formatUnknownError(error);
}
