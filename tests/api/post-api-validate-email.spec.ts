import { test, expect } from '@playwright/test';
import { assertMatchesSchema } from '../../utils/schema-validator';

test.describe('POST /api/validate-email - Email validation', () => {
    /**
     * Verifies that sending a valid email address string results in a 500 Internal Server Error,
     * as the email validation service is known to be temporarily unavailable.
     * The response body should conform to the `main.ErrorResponse` schema.
     * Request body: { "email": "test@example.com" }
     * Expected result: 500 status, error message indicating service unavailability.
     */
    test('returns 500 for a valid email string due to service unavailability', async ({ request }) => {
        const emailPayload = { email: 'test@example.com' };
        const response = await request.post('/api/validate-email', { data: emailPayload });

        expect(response.status()).toBe(500);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBeDefined();
        expect(body.error).toContain('Email validation service temporarily unavailable');
    });

    /**
     * Verifies that sending an email address string with an invalid format also results in a 500 Internal Server Error,
     * consistent with the known behavior that the service does not perform format validation and is unavailable.
     * The response body should conform to the `main.ErrorResponse` schema.
     * Request body: { "email": "not-an-email" }
     * Expected result: 500 status, error message indicating service unavailability.
     */
    test('returns 500 for an invalid email format string due to service unavailability', async ({ request }) => {
        const emailPayload = { email: 'not-an-email' };
        const response = await request.post('/api/validate-email', { data: emailPayload });

        expect(response.status()).toBe(500);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBeDefined();
        expect(body.error).toContain('Email validation service temporarily unavailable');
    });

    /**
     * Verifies that sending an empty JSON body results in a 500 Internal Server Error,
     * as the missing email field still triggers the unavailable validation service.
     * The response body should conform to the `main.ErrorResponse` schema.
     * Request body: {}
     * Expected result: 500 status, error message indicating service unavailability.
     */
    test('returns 500 for an empty JSON body due to service unavailability', async ({ request }) => {
        const emptyPayload = {};
        const response = await request.post('/api/validate-email', { data: emptyPayload });

        expect(response.status()).toBe(500);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBeDefined();
        expect(body.error).toContain('Email validation service temporarily unavailable');
    });

    /**
     * Verifies that sending a request with the 'email' field as a non-string type (e.g., a number)
     * results in a 400 Bad Request error due to JSON decoding failure.
     * The response body should conform to the `main.ErrorResponse` schema.
     * Request body: { "email": 12345 }
     * Expected result: 400 status, error message indicating an invalid request.
     */
    test('returns 400 for a non-string email field type', async ({ request }) => {
        const invalidTypePayload = { email: 12345 }; // 'email' as a number
        const response = await request.post('/api/validate-email', { data: invalidTypePayload });

        expect(response.status()).toBe(400);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBeDefined();
        expect(body.error).toContain('Invalid request');
    });
});
