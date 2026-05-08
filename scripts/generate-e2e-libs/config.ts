import path from 'path';
import type { GeneratorConfig } from './types';

export const KNOWN_FACTS = [
    '- The card number input auto-formats input by inserting spaces every 4 digits, so typing `4242424242424242` results in the displayed value `4242 4242 4242 4242`.',
    '- The expiry input auto-formats to `MM/YY` after the second digit is entered.',
    '- Email validation runs on blur and the email API endpoint always returns 500 in this app, so the UI soft-fails: it shows a yellow warning but still treats the email as valid for submission.',
    '- Card validation runs on blur. Valid Luhn cards show an inline message containing `✅ Valid card number`, invalid cards show `❌ Invalid card number`.',
    '- Submitting the form posts to `/api/checkout` and renders a message that starts with `✅` on success or `❌` on failure. The success message text is sourced from the API response `message` field.',
    '- The submit button text is `Complete Payment` when the amount field is empty, `Pay $<amount>` when the amount field has a value, and `Processing Payment...` while the request is in flight.',
    '- The page lives at the site root (`/`). There is no separate `/checkout` route.',
].join('\n');

/**
 * Builds all filesystem and model settings for the E2E generator. Environment variables override the paymongo-assessment-app-code
 * directory, page source path, Gemini model, and retry count without changing the committed script.
 */
export function createConfig(repoRoot: string): GeneratorConfig {
    const appCodeDir = process.env.APP_CODE_DIR
        ? path.resolve(process.env.APP_CODE_DIR)
        : path.resolve(repoRoot, '..', 'paymongo-assessment-app-code');

    return {
        repoRoot,
        appCodeDir,
        pageSourcePath: process.env.FRONTEND_PAGE_PATH
            ? path.resolve(process.env.FRONTEND_PAGE_PATH)
            : path.join(appCodeDir, 'app', 'page.tsx'),
        promptTemplatePath: path.join(repoRoot, 'scripts', 'prompts', 'e2e-test.prompt.md'),
        generatedTestDir: path.join(repoRoot, 'scripts', 'generated_test', 'web'),
        runnableTestDir: path.join(repoRoot, 'tests', 'web'),
        generatedFileName: 'checkout.spec.ts',
        cachePath: path.join(repoRoot, 'scripts', 'generated_test', '.cache.json'),
        modelName: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        maxRetries: Number.parseInt(process.env.GENERATOR_MAX_RETRIES || '2', 10),
        minimumExpectCount: Number.parseInt(process.env.E2E_TEST_MIN_EXPECTS || '3', 10),
    };
}
