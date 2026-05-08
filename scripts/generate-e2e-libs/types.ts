export interface ExtractedInput {
    name: string;
    type: string;
    required: boolean;
    maxLength?: number;
    placeholder?: string;
}

export interface ExtractedSelectors {
    inputs: ExtractedInput[];
    submitButton: {
        role: 'button';
        nameMatches: string[];
        notes: string;
    };
    knownFieldNames: string[];
}

export interface GeneratorConfig {
    repoRoot: string;
    appCodeDir: string;
    pageSourcePath: string;
    promptTemplatePath: string;
    generatedTestDir: string;
    runnableTestDir: string;
    generatedFileName: string;
    cachePath: string;
    modelName: string;
    maxRetries: number;
    minimumExpectCount: number;
}
