import path from 'path';
import type { GeneratorConfig } from './types';

export const KNOWN_FACTS = [
    '- Swagger is version 2.0 and uses `definitions`, not OpenAPI 3 `components.schemas`.',
    '- `/api/checkout` is a mock implementation. It returns 200 success for valid JSON, including semantically bogus values and empty JSON objects `{}`. Do NOT write a test expecting 400 for an empty body — an empty object is accepted and returns 200.',
    '- `/api/checkout` also returns 200 when any individual field is missing or empty (e.g. missing `cardNumber`, empty `cardNumber`, missing `expiry`). It ONLY returns 400 for JSON type mismatches such as a field being the wrong Go type (e.g. `amount` or `expiry` as a number instead of the expected type). Do NOT write tests expecting 400 for missing required fields.',
    '- `/api/checkout` returns 400 for JSON type mismatches. The exact `error` string includes the Go decode message, for example: `"Invalid request: json: cannot unmarshal string into Go struct field PaymentRequest.amount of type float64"`. Do NOT assert on the exact full string — assert using `toContain("Invalid request")` or `toMatch(/Invalid request/)` to be resilient to minor message changes.',
    '- `/api/checkout` applies the same partial-message pattern for every field type mismatch (e.g. `expiry` as a number also produces `"Invalid request: json: cannot unmarshal number into Go struct field PaymentRequest.expiry of type string"`). Always use `toContain("Invalid request")` for 400 error assertions on this endpoint.',
    '- `/api/validate-card` performs a Luhn check. Valid cards return 200 with `{ valid: true, message: "Card number validated" }`. Invalid, empty, too-short, or missing card numbers all return 200 with `{ valid: false, message: "Invalid card number (Luhn check failed)" }`. The endpoint NEVER returns 4xx for missing or wrong-type card fields — it always returns 200 with valid:false.',
    '- `/api/validate-card` returns 400 only when the `cardNumber` field value is a non-string type (e.g. a number). The exact response is `{ "error": "Invalid request" }`.',
    '- `/api/validate-email` returns 500 with `{ "error": "Email validation service temporarily unavailable" }` for valid JSON bodies where `email` is a string, even when the email format is valid.',
    '- `/api/validate-email` ALWAYS returns 500 for any valid JSON where `email` is a string — it does NOT perform format validation. An invalid email format like `"not-an-email"` still returns 500, not 400.',
    '- `/api/validate-email` also returns 500 for an empty JSON body `{}` (the missing email field still hits the broken service). Only a non-string `email` value (e.g. a number) returns 400.',
    '- `/api/validate-email` returns 400 with `{ "error": "Invalid request" }` when JSON decoding fails, such as when `email` is a number (e.g. `{"email": 12345}`) or the body is not valid JSON.',
    '- To send a deliberately malformed/invalid JSON body in a Playwright API test, use `request.post(path, { data: undefined, headers: { "Content-Type": "application/json" } })` with the raw string passed as the body via `fetch` — OR simply pass a body where a field has the wrong type (e.g. `{ email: 12345 }`). Do NOT call `JSON.parse()` on an intentionally broken string inside the test body — that will throw a SyntaxError before the request is ever sent.',
    '- Known valid card data: `4242424242424242` and `4242 4242 4242 4242`.',
    '- Known invalid card data: `1234567890123456` and `123`.',
    '- Known checkout payload: `{ "cardNumber": "4242 4242 4242 4242", "expiry": "12/26", "cvv": "123", "amount": 50 }`.',
].join('\n');

/**
 * Builds all filesystem and model settings from the current repository layout and environment variables.
 * Environment variables can override the paymongo-assessment-app-code directory, Swagger path, Gemini model, and retry count without
 * changing the committed script.
 */
export function createConfig(repoRoot: string): GeneratorConfig {
    const appCodeDir = process.env.APP_CODE_DIR
        ? path.resolve(process.env.APP_CODE_DIR)
        : path.resolve(repoRoot, '..', 'paymongo-assessment-app-code');

    return {
        repoRoot,
        appCodeDir,
        swaggerPath: process.env.SWAGGER_PATH
            ? path.resolve(process.env.SWAGGER_PATH)
            : path.join(appCodeDir, 'docs', 'swagger.json'),
        promptTemplatePath: path.join(repoRoot, 'scripts', 'prompts', 'api-test.prompt.md'),
        generatedTestDir: path.join(repoRoot, 'scripts', 'generated_test', 'api'),
        runnableTestDir: path.join(repoRoot, 'tests', 'api'),
        cachePath: path.join(repoRoot, 'scripts', 'generated_test', '.cache.json'),
        modelName: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        maxRetries: Number.parseInt(process.env.GENERATOR_MAX_RETRIES || '2', 10),
        minimumExpectCount: Number.parseInt(process.env.API_TEST_MIN_EXPECTS || '2', 10),
    };
}
