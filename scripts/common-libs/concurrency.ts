/**
 * Runs `tasks` with a maximum of `limit` in flight at once, preserving result order.
 * Implemented locally to avoid pulling in `p-limit` for a single use site.
 */
export async function mapWithConcurrency<TInput, TOutput>(
    inputs: readonly TInput[],
    limit: number,
    worker: (input: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
    if (limit <= 0) {
        throw new Error('Concurrency limit must be a positive integer.');
    }

    const results: TOutput[] = new Array(inputs.length);
    let nextIndex = 0;

    async function runOne(): Promise<void> {
        while (true) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            if (currentIndex >= inputs.length) {
                return;
            }
            results[currentIndex] = await worker(inputs[currentIndex], currentIndex);
        }
    }

    const workerCount = Math.min(limit, inputs.length);
    const workers = Array.from({ length: workerCount }, () => runOne());
    await Promise.all(workers);
    return results;
}
