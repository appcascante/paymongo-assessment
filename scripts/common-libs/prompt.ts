import { createHash } from 'crypto';

/**
 * Replaces a small set of prompt-template tokens without relying on JavaScript APIs newer than the repository's
 * ES2020 TypeScript target.
 */
export function fillPromptTemplate(template: string, replacements: Record<string, string>): string {
    let prompt = template;
    for (const [token, value] of Object.entries(replacements)) {
        prompt = prompt.split(token).join(value);
    }
    return prompt;
}

/**
 * Computes a deterministic SHA-256 hash so unchanged prompt inputs can be skipped on later generator runs without
 * needing to contact the LLM.
 */
export function createHashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

/**
 * Removes a single surrounding TypeScript markdown code fence when the model returns fenced code despite the
 * prompt's output-only instruction.
 */
export function stripCodeFence(modelOutput: string): string {
    const trimmedOutput = modelOutput.trim();
    const fencedMatch = trimmedOutput.match(/^```(?:ts|typescript)?\s*([\s\S]*?)\s*```$/i);
    return (fencedMatch ? fencedMatch[1] : trimmedOutput).trim();
}

/**
 * Adds validation feedback to the next prompt attempt, giving the model precise instructions for repairing only the
 * contract violations found by local guardrails.
 */
export function buildRetryPrompt(originalPrompt: string, attemptNumber: number, errors: readonly string[]): string {
    return `${originalPrompt}\n\nThe previous attempt ${attemptNumber} was rejected for these reasons:\n${errors
        .map((error) => `- ${error}`)
        .join('\n')}\n\nReturn a corrected complete TypeScript spec file that satisfies every output contract rule.`;
}
