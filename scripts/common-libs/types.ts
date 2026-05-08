export interface CacheEntry {
    hash: string;
    modelName: string;
    generatedTestPath: string;
    runnableTestPath: string;
    generatedAt: string;
}

export interface CacheFile {
    api: Record<string, CacheEntry>;
    web: Record<string, CacheEntry>;
}
