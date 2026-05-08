export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
    [key: string]: JsonValue;
}

export interface SwaggerSchema {
    $ref?: string;
    type?: string;
    format?: string;
    example?: JsonValue;
    enum?: JsonValue[];
    properties?: Record<string, SwaggerSchema>;
    required?: string[];
    items?: SwaggerSchema;
}

export interface SwaggerParameter {
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: SwaggerSchema;
}

export interface SwaggerResponse {
    description?: string;
    schema?: SwaggerSchema;
}

export interface SwaggerOperation {
    summary?: string;
    description?: string;
    tags?: string[];
    consumes?: string[];
    produces?: string[];
    parameters?: SwaggerParameter[];
    responses: Record<string, SwaggerResponse>;
}

export interface SwaggerSpec {
    swagger: string;
    host?: string;
    basePath?: string;
    paths: Record<string, Partial<Record<HttpMethod, SwaggerOperation>>>;
    definitions: Record<string, SwaggerSchema>;
}

export interface EndpointContext {
    method: HttpMethod;
    pathName: string;
    fileName: string;
    operation: SwaggerOperation;
}

export interface GeneratorConfig {
    repoRoot: string;
    appCodeDir: string;
    swaggerPath: string;
    promptTemplatePath: string;
    generatedTestDir: string;
    runnableTestDir: string;
    cachePath: string;
    modelName: string;
    maxRetries: number;
    minimumExpectCount: number;
}

export const HTTP_METHODS: readonly HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
