import { test, expect } from '@playwright/test';
import { assertMatchesSchema } from '../../utils/schema-validator';

test.describe('POST /api/validate-email - Email validation', () => {
    /**
     * Verifies that sending a valid email address string results in a 500 Internal Server Error,
     * as the email validation service is known to be temporarily unavailable.
     * The response body should conform to the `main.ErrorResponse` schema.
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
     * Verifies that sending an email address string with an invalid format still results in a 500 Internal Server Error,
     * as the service does not perform format validation and is temporarily unavailable.
     * The response body should conform to the `main.ErrorResponse` schema.
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
     * as the missing email field still triggers the unavailable service.
     * The response body should conform to the `main.ErrorResponse` schema.
     */
    test('returns 500 for an empty JSON body due to service unavailability', async ({ request }) => {
        const response = await request.post('/api/validate-email', { data: {} });

        expect(response.status()).toBe(500);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBeDefined();
        expect(body.error).toContain('Email validation service temporarily unavailable');
    });

    /**
     * Verifies that sending a non-string type for the 'email' field results in a 400 Bad Request,
     * indicating a JSON decoding failure.
     * The response body should conform to the `main.ErrorResponse` schema.
     */
    test('returns 400 for a non-string email field', async ({ request }) => {
        const emailPayload = { email: 12345 }; // Invalid type for email
        const response = await request.post('/api/validate-email', { data: emailPayload });

        expect(response.status()).toBe(400);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBeDefined();
        expect(body.error).toBe('Invalid request');
    });
});
