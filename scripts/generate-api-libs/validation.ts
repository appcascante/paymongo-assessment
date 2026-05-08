import { compileGeneratedCode } from '../common-libs/compiler';
import { formatUnknownError } from '../common-libs/utils';
import type { EndpointContext, GeneratorConfig } from './types';

/**
 * Validates generated code using fast static guardrails and a TypeScript compile check before the file is written to
 * the Playwright test tree.
 */
export async function validateGeneratedCode(
    code: string,
    endpoint: EndpointContext,
    allowedPaths: ReadonlySet<string>,
    config: GeneratorConfig
): Promise<string[]> {
    const errors = collectStaticValidationErrors(code, endpoint, allowedPaths, config.minimumExpectCount);

    if (errors.length === 0) {
        try {
            await compileGeneratedCode(code, config.repoRoot, config.runnableTestDir);
        } catch (error) {
            errors.push(formatUnknownError(error));
        }
    }

    return errors;
}

/**
 * Applies deterministic text-level checks for import order, Playwright focus markers, assertion density, and endpoint
 * scope before the slower TypeScript compiler is invoked.
 */
export function collectStaticValidationErrors(
    code: string,
    endpoint: EndpointContext,
    allowedPaths: ReadonlySet<string>,
    minimumExpectCount: number
): string[] {
    const errors: string[] = [];
    const firstLine = code.split(/\r?\n/, 1)[0]?.trim();
    const expectCount = code.match(/\bexpect\s*\(/g)?.length || 0;

    if (firstLine !== "import { test, expect } from '@playwright/test';") {
        errors.push("The first line must exactly import `{ test, expect }` from '@playwright/test'.");
    }

    if (/\btest\.only\b|\btest\.describe\.only\b/.test(code)) {
        errors.push('Generated code must not include focused Playwright tests.');
    }

    if (/\btest\.skip\b/.test(code)) {
        errors.push('Generated code must not skip tests.');
    }

    if (/https?:\/\//i.test(code)) {
        errors.push('Generated code must use relative API paths only and must not contain absolute URLs.');
    }

    if (/\bpage\b|\bbrowser\b/.test(code)) {
        errors.push('Generated API tests must not use page or browser fixtures.');
    }

    if (expectCount < minimumExpectCount) {
        errors.push(`Generated code must include at least ${minimumExpectCount} expect(...) assertions.`);
    }

    errors.push(...collectRequestPathErrors(code, endpoint, allowedPaths));
    return errors;
}

/**
 * Extracts Playwright request calls and ensures every call stays on the current endpoint path and known Swagger path
 * set, preventing hallucinated routes or cross-endpoint test generation.
 *
 * The path argument MUST be an inline string literal (single quote, double quote, or backtick with no interpolation)
 * so the path can be statically verified against the Swagger paths set. A path stored in a `const` variable cannot
 * be checked, so we reject it with an actionable error rather than the misleading "no request call detected".
 */
export function collectRequestPathErrors(
    code: string,
    endpoint: EndpointContext,
    allowedPaths: ReadonlySet<string>
): string[] {
    const errors: string[] = [];
    const literalCallPattern = /request\.(get|post|put|patch|delete|fetch)\(\s*['"`]([^'"`$]+)['"`]/g;
    const anyCallPattern = /\brequest\.(get|post|put|patch|delete|fetch)\s*\(/g;
    const matches = [...code.matchAll(literalCallPattern)];
    const anyCalls = [...code.matchAll(anyCallPattern)];

    if (anyCalls.length === 0) {
        errors.push('Generated code must call Playwright request fixture at least once.');
        return errors;
    }

    if (matches.length < anyCalls.length) {
        errors.push(
            'Every `request.<method>(...)` call must pass the endpoint path as an inline string literal (e.g. `request.post(\'/api/validate-email\', ...)`). Do not store the path in a variable, constant, or interpolated template literal.'
        );
    }

    if (matches.length === 0) {
        return errors;
    }

    for (const match of matches) {
        const requestMethod = match[1] || '';
        const requestPath = match[2] || '';
        const pathWithoutQuery = requestPath.split('?')[0] || requestPath;

        if (!requestPath.startsWith('/')) {
            errors.push(`Request path "${requestPath}" must be relative and start with '/'.`);
        }

        if (!allowedPaths.has(pathWithoutQuery)) {
            errors.push(`Request path "${requestPath}" is not present in the Swagger paths object.`);
        }

        if (pathWithoutQuery !== endpoint.pathName) {
            errors.push(`Generated file for ${endpoint.method.toUpperCase()} ${endpoint.pathName} must not call ${requestPath}.`);
        }

        if (requestMethod !== 'fetch' && requestMethod !== endpoint.method) {
            errors.push(
                `Generated file for ${endpoint.method.toUpperCase()} ${endpoint.pathName} must use request.${endpoint.method}(...), not request.${requestMethod}(...).`
            );
        }
    }

    return errors;
}
