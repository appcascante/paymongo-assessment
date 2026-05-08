import { readFile } from 'fs/promises';
import { isRecord } from '../common-libs/utils';
import { HTTP_METHODS } from './types';
import type { EndpointContext, HttpMethod, SwaggerOperation, SwaggerSchema, SwaggerSpec } from './types';

/**
 * Reads and parses a JSON file, returning the result as unknown so callers must validate the shape before use.
 */
export async function readJsonFile(filePath: string): Promise<unknown> {
    const fileContent = await readFile(filePath, 'utf8');
    return JSON.parse(fileContent) as unknown;
}

/**
 * Converts unknown JSON into the narrow Swagger shape required by this generator and fails early when the contract
 * is missing the `paths` object needed to generate endpoint-specific tests.
 */
export function parseSwaggerSpec(value: unknown): SwaggerSpec {
    if (!isRecord(value) || !isRecord(value.paths)) {
        throw new Error('Swagger file must contain a top-level paths object.');
    }

    const definitions = isRecord(value.definitions)
        ? (value.definitions as Record<string, SwaggerSchema>)
        : {};

    return {
        swagger: typeof value.swagger === 'string' ? value.swagger : '2.0',
        host: typeof value.host === 'string' ? value.host : undefined,
        basePath: typeof value.basePath === 'string' ? value.basePath : undefined,
        paths: value.paths as Record<string, Partial<Record<HttpMethod, SwaggerOperation>>>,
        definitions,
    };
}

/**
 * Extracts every supported HTTP operation from the Swagger paths object and assigns each endpoint a deterministic
 * file name that matches the existing generated-test submission layout.
 */
export function extractEndpoints(swagger: SwaggerSpec): EndpointContext[] {
    const endpoints: EndpointContext[] = [];

    for (const [pathName, pathItem] of Object.entries(swagger.paths)) {
        if (!isRecord(pathItem)) {
            continue;
        }

        for (const method of HTTP_METHODS) {
            const operation = pathItem[method];
            if (operation && isRecord(operation) && isRecord(operation.responses)) {
                endpoints.push({
                    method,
                    pathName,
                    fileName: `${method}-${toFileSlug(pathName)}.spec.ts`,
                    operation: operation as unknown as SwaggerOperation,
                });
            }
        }
    }

    return endpoints.sort((firstEndpoint, secondEndpoint) =>
        `${firstEndpoint.pathName}:${firstEndpoint.method}`.localeCompare(`${secondEndpoint.pathName}:${secondEndpoint.method}`)
    );
}

/**
 * Converts an API path into a stable lowercase file slug while preserving enough endpoint detail for review.
 */
export function toFileSlug(pathName: string): string {
    return pathName
        .replace(/^\/+/, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}
