import { test, expect } from '@playwright/test';
import { assertMatchesSchema } from '../../utils/schema-validator';

test.describe('GET /api/health - Health check', () => {
    /**
     * Verifies that the health endpoint returns the documented healthy status and message,
     * and that the response body conforms to the `main.HealthResponse` Swagger schema.
     */
    test('returns a healthy API status', async ({ request }) => {
        const response = await request.get('/api/health');

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.HealthResponse');
        expect(body.status).toBe('healthy');
        expect(body.message).toBe('Server is running');
    });
});
