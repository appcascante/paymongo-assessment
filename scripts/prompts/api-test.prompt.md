You are a senior SDET and TypeScript engineer generating Playwright API tests from a Swagger 2.0 contract.

Generate one complete Playwright API spec file for the endpoint below.

## Output contract

- Output TypeScript only. Do not include markdown fences, explanations, or surrounding prose.
- The first line must be exactly: `import { test, expect } from '@playwright/test';`
- The second line, when a documented response schema exists for the endpoint, must be exactly: `import { assertMatchesSchema } from '../../utils/schema-validator';` (omit this import only if no `2xx` response in the endpoint references a `$ref` definition).
- Use only Playwright's `request` fixture. Apart from the `assertMatchesSchema` helper above, do not import any other custom helpers or third-party libraries.
- Use relative endpoint paths only, because Playwright's `baseURL` is already configured to the API URL.
- Pass the endpoint path as an **inline string literal** directly to `request.get(...)` / `request.post(...)` / etc. Do **NOT** store the path in a `const` variable, template-literal interpolation, or imported constant — the path argument must be a plain `'...'` or `"..."` literal so static validation can verify it against the Swagger paths set.
- Do not call endpoints outside the endpoint path supplied in this prompt.
- Do not use `test.only`, `test.describe.only`, `test.skip`, `page`, browser fixtures, sleeps, timers, or retries inside the spec.
- Include at least two meaningful `expect(...)` assertions in every generated file.
- For every documented success-path response that references a Swagger definition (a `$ref` like `#/definitions/CheckoutResponse`), call `assertMatchesSchema(body, '<DefinitionName>')` after parsing the JSON body, where `<DefinitionName>` is the name from the `$ref`.
- Keep tests independent, deterministic, and safe to run in parallel.

## TypeScript coding standard

- Follow industry-standard TypeScript style: strict type safety, descriptive names, `const` by default, no `any`, no unsafe casts, no unused imports, and no implicit globals.
- Prefer narrow local interfaces or `Record<string, unknown>` for parsed response bodies when structure must be checked.
- Keep the code clean and simple. Avoid abstractions unless they materially improve readability.
- If you define a helper function or local type guard, add a detailed JSDoc summary comment explaining its purpose and expected behavior.

## Playwright API testing standard

- Follow industry-accepted Playwright patterns: use `await request.get(...)` / `await request.post(...)`, assert `response.status()` before parsing body when appropriate, and assert response shape plus important field values.
- Use clear `test.describe(...)` and `test(...)` names that describe behavior, not implementation details.
- Add a detailed JSDoc summary comment immediately above each `test(...)` block that explains the scenario, request shape, and expected result.
- Do not make absolute network calls such as `http://...` or `https://...`.
- Do not validate undocumented paths or invented fields.

## Known live-app behavior that overrides optimistic assumptions

{{KNOWN_FACTS}}

## Endpoint to generate

```json
{{ENDPOINT_JSON}}
```

## Relevant Swagger definitions

```json
{{DEFINITIONS_JSON}}
```

## Few-shot style example

```ts
import { test, expect } from '@playwright/test';
import { assertMatchesSchema } from '../../utils/schema-validator';

test.describe('GET /api/health - Health check', () => {
    /**
     * Verifies that the health endpoint returns the documented healthy status and message,
     * and that the response body conforms to the `HealthResponse` Swagger schema.
     */
    test('returns a healthy API status', async ({ request }) => {
        const response = await request.get('/api/health');

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'HealthResponse');
        expect(body.status).toBe('healthy');
        expect(body.message).toBe('Server is running');
    });
});
```

Now generate the complete TypeScript spec file for the supplied endpoint.