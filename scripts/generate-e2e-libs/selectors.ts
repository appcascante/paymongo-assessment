import type { ExtractedInput, ExtractedSelectors } from './types';

/**
 * Extracts every `<input ... />` JSX block from the page source and parses its attributes into a strongly typed
 * record so the prompt receives real selectors instead of letting the LLM hallucinate field names.
 */
export function extractSelectors(pageSource: string): ExtractedSelectors {
    const inputBlockPattern = /<input\b([\s\S]*?)\/>/g;
    const inputs: ExtractedInput[] = [];
    const seenNames = new Set<string>();

    for (const match of pageSource.matchAll(inputBlockPattern)) {
        const attributesBlock = match[1] || '';
        const name = readStringAttribute(attributesBlock, 'name');
        if (!name || seenNames.has(name)) {
            continue;
        }
        seenNames.add(name);

        inputs.push({
            name,
            type: readStringAttribute(attributesBlock, 'type') || 'text',
            required: /\brequired\b/.test(attributesBlock),
            maxLength: readNumericAttribute(attributesBlock, 'maxLength'),
            placeholder: readStringAttribute(attributesBlock, 'placeholder'),
        });
    }

    if (inputs.length === 0) {
        throw new Error('No <input name="..."> elements were found in the frontend source.');
    }

    return {
        inputs,
        submitButton: {
            role: 'button',
            nameMatches: ['Complete Payment', /Pay \$\d/.source, 'Processing Payment...'],
            notes: 'Submit control is rendered as <button type="submit"> with dynamic text. Use a role-based locator with a regular expression that matches both idle and amount-filled states.',
        },
        knownFieldNames: inputs.map((input) => input.name),
    };
}

/**
 * Reads the value of a string attribute (single or double quoted) from a JSX attribute block, returning undefined
 * when the attribute is absent so callers can apply fallbacks.
 */
export function readStringAttribute(attributesBlock: string, attributeName: string): string | undefined {
    const stringPattern = new RegExp(`\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
    const match = attributesBlock.match(stringPattern);
    return match ? match[1] ?? match[2] : undefined;
}

/**
 * Reads the value of a numeric JSX attribute written as `name={123}` and returns undefined when the attribute is
 * absent or not a finite number.
 */
export function readNumericAttribute(attributesBlock: string, attributeName: string): number | undefined {
    const numericPattern = new RegExp(`\\b${attributeName}\\s*=\\s*\\{\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\}`);
    const match = attributesBlock.match(numericPattern);
    if (!match) {
        return undefined;
    }
    const value = Number.parseFloat(match[1] ?? '');
    return Number.isFinite(value) ? value : undefined;
}
