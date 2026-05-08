import { compileGeneratedCode } from '../common-libs/compiler';
import { formatUnknownError } from '../common-libs/utils';
import type { ExtractedSelectors, GeneratorConfig } from './types';

/**
 * Validates the generated E2E spec using fast static guardrails followed by a TypeScript compile check before the
 * file is written to the Playwright test tree.
 */
export async function validateGeneratedCode(
    code: string,
    selectors: ExtractedSelectors,
    config: GeneratorConfig
): Promise<string[]> {
    const errors = collectStaticValidationErrors(code, selectors, config.minimumExpectCount);

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
 * Applies deterministic text-level checks for import order, focused tests, sleeps, absolute URLs, assertion density,
 * and selector hygiene before the slower TypeScript compiler is invoked.
 */
export function collectStaticValidationErrors(
    code: string,
    selectors: ExtractedSelectors,
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

    if (/page\.waitForTimeout|setTimeout\s*\(/.test(code)) {
        errors.push('Generated code must not use waitForTimeout or setTimeout sleeps; rely on auto-waiting locators.');
    }

    if (/https?:\/\//i.test(code)) {
        errors.push('Generated code must not contain absolute URLs; use relative navigation via baseURL.');
    }

    if (/\brequest\s*[.:]/i.test(code) && /request\.(get|post|put|patch|delete|fetch)\s*\(/.test(code)) {
        errors.push('Generated E2E tests must drive the UI through the page fixture and must not call the API directly.');
    }

    if (expectCount < minimumExpectCount) {
        errors.push(`Generated code must include at least ${minimumExpectCount} expect(...) assertions.`);
    }

    if (!/page\.goto\s*\(\s*['"`]\/['"`]\s*\)/.test(code)) {
        errors.push("Generated code must call page.goto('/') to navigate to the checkout page.");
    }

    errors.push(...collectFieldSelectorErrors(code, selectors));

    return errors;
}

/**
 * Ensures the generated spec only references input names that actually exist in the extracted frontend source so
 * hallucinated fields are caught before the test reaches the runtime.
 */
export function collectFieldSelectorErrors(code: string, selectors: ExtractedSelectors): string[] {
    const errors: string[] = [];
    const inputNamePattern = /input\[name="([^"]+)"\]/g;
    const allowedNames = new Set(selectors.knownFieldNames);
    const usedNames = new Set<string>();

    for (const match of code.matchAll(inputNamePattern)) {
        const usedName = match[1] ?? '';
        usedNames.add(usedName);
        if (!allowedNames.has(usedName)) {
            errors.push(`Selector input[name="${usedName}"] does not exist in the frontend source.`);
        }
    }

    if (usedNames.size === 0) {
        errors.push('Generated code must use input[name="..."] selectors for at least one form field.');
    }

    if (/getByLabel\s*\(/.test(code)) {
        errors.push('Generated code must not use getByLabel because labels in this app are not programmatically associated with inputs.');
    }

    if (/getByText\s*\(\s*\/\s*[✅❌]\s*\//.test(code)) {
        errors.push('Generated code must not assert on a bare emoji regex like /✅/ or /❌/. Include disambiguating words after the emoji (e.g. /✅ Payment/) because two ✅-prefixed strings can be visible at once.');
    }

    return errors;
}
