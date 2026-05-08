/**
 * Runtime JSON-schema validator used by AI-generated API tests.
 *
 * The generator injects calls like `assertMatchesSchema(body, 'CheckoutResponse')` into the spec body so that the
 * response payload is validated against the exact schema declared in the live `swagger.json` of the app under test.
 * This converts the Swagger contract into runtime contract enforcement: even if the LLM hallucinates a field name in
 * an `expect(...)` line, ajv catches drift between the contract and the response shape and the test fails loudly.
 *
 * The Swagger file is read from APP_CODE_DIR/docs/swagger.json (or SWAGGER_PATH if set) and the compiled validators
 * are cached per process so repeated calls within a test run are cheap.
 */
import { readFileSync } from 'fs';
import path from 'path';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

interface SwaggerDefinitions {
    [name: string]: Record<string, unknown>;
}

interface SwaggerLike {
    definitions?: SwaggerDefinitions;
    components?: { schemas?: SwaggerDefinitions };
}

let cachedAjv: Ajv | undefined;
let cachedValidators: Map<string, ValidateFunction> | undefined;
let cachedDefinitions: SwaggerDefinitions | undefined;

/**
 * Resolves the swagger.json path the same way the generator does so local runs and CI use the same source of truth.
 */
function resolveSwaggerPath(): string {
    if (process.env.SWAGGER_PATH) {
        return path.resolve(process.env.SWAGGER_PATH);
    }
    const appCodeDir = process.env.APP_CODE_DIR
        ? path.resolve(process.env.APP_CODE_DIR)
        : path.resolve(__dirname, '..', '..', 'paymongo-assessment-app-code');
    return path.join(appCodeDir, 'docs', 'swagger.json');
}

function loadDefinitions(): SwaggerDefinitions {
    if (cachedDefinitions) {
        return cachedDefinitions;
    }
    const raw = readFileSync(resolveSwaggerPath(), 'utf8');
    const parsed = JSON.parse(raw) as SwaggerLike;
    const definitions = parsed.definitions || parsed.components?.schemas || {};
    cachedDefinitions = definitions;
    return definitions;
}

/**
 * Resolves a definition name against the Swagger definitions map.
 * Accepts either the exact key (e.g. 'main.PaymentResponse') or the bare suffix
 * after the last dot (e.g. 'PaymentResponse') so generated tests remain valid
 * regardless of whether the LLM includes the Go package prefix.
 */
function resolveDefinitionName(name: string, definitions: SwaggerDefinitions): string | undefined {
    if (definitions[name]) {
        return name;
    }
    // Try matching by suffix: 'PaymentResponse' matches 'main.PaymentResponse'
    const suffix = name.includes('.') ? name : null;
    if (!suffix) {
        const match = Object.keys(definitions).find((k) => k === name || k.endsWith(`.${name}`));
        return match;
    }
    return undefined;
}

function getAjv(): Ajv {
    if (!cachedAjv) {
        cachedAjv = new Ajv({ allErrors: true, strict: false });
        addFormats(cachedAjv);
    }
    return cachedAjv;
}

/**
 * Compiles (and caches) the ajv validator for the named Swagger definition. Throws if the definition does not exist
 * so a typo in a generated test surfaces as a fast, descriptive error rather than a silent pass.
 */
export function getSchemaValidator(definitionName: string): ValidateFunction {
    if (!cachedValidators) {
        cachedValidators = new Map<string, ValidateFunction>();
    }
    const existing = cachedValidators.get(definitionName);
    if (existing) {
        return existing;
    }
    const definitions = loadDefinitions();
    const resolvedName = resolveDefinitionName(definitionName, definitions);
    if (!resolvedName) {
        throw new Error(
            `Swagger definition "${definitionName}" not found. Available: ${Object.keys(definitions).join(', ') || '(none)'}.`
        );
    }
    const schema = definitions[resolvedName];
    const validator = getAjv().compile(schema);
    cachedValidators.set(definitionName, validator);
    return validator;
}

/**
 * Validates `body` against the Swagger definition with the given name. Throws an error with all ajv error messages
 * joined into a single string when validation fails — this surfaces as a Playwright assertion-style failure with the
 * field path, so reviewers immediately see which field drifted from the contract.
 */
export function assertMatchesSchema(body: unknown, definitionName: string): void {
    const validator = getSchemaValidator(definitionName);
    if (validator(body)) {
        return;
    }
    const errors = (validator.errors || [])
        .map((err) => `  - ${err.instancePath || '(root)'} ${err.message ?? 'failed validation'}`)
        .join('\n');
    throw new Error(`Response body did not match Swagger definition "${definitionName}":\n${errors}`);
}
