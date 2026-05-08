import { fillPromptTemplate } from '../common-libs/prompt';
import { KNOWN_FACTS } from './config';
import type { EndpointContext, JsonObject, JsonValue, SwaggerSpec } from './types';

/**
 * Builds the endpoint JSON payload injected into the prompt so Gemini receives only the operation it is expected to
 * test, plus enough metadata to create focused describe and test titles.
 */
export function createEndpointPromptData(endpoint: EndpointContext): JsonObject {
    return {
        method: endpoint.method.toUpperCase(),
        path: endpoint.pathName,
        summary: endpoint.operation.summary || '',
        description: endpoint.operation.description || '',
        parameters: (endpoint.operation.parameters || []) as unknown as JsonValue[],
        responses: endpoint.operation.responses as unknown as JsonObject,
    };
}

/**
 * Creates the full prompt for a single endpoint, including known live-app quirks that intentionally override the
 * optimistic Swagger response descriptions.
 */
export function buildPrompt(template: string, swagger: SwaggerSpec, endpoint: EndpointContext): string {
    return fillPromptTemplate(template, {
        '{{KNOWN_FACTS}}': KNOWN_FACTS,
        '{{ENDPOINT_JSON}}': JSON.stringify(createEndpointPromptData(endpoint), null, 2),
        '{{DEFINITIONS_JSON}}': JSON.stringify(swagger.definitions, null, 2),
    });
}
