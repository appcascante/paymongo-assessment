import { test, expect } from '@playwright/test';
import { assertMatchesSchema } from '../../utils/schema-validator';

test.describe('POST /api/validate-card - Card validation', () => {
    /**
     * Verifies that a valid credit card number (Luhn check passes) returns a 200 OK response
     * with `valid: true` and the expected success message, conforming to the `main.CardResponse` schema.
     * Request body: `{"cardNumber": "4242424242424242"}`
     * Expected response: `{"valid": true, "message": "Card number validated"}`
     */
    test('should return 200 OK for a valid card number', async ({ request }) => {
        const validCardNumber = '4242424242424242';
        const response = await request.post('/api/validate-card', {
            data: { cardNumber: validCardNumber },
        });

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.CardResponse');
        expect(body.valid).toBe(true);
        expect(body.message).toContain('Card number validated');
    });

    /**
     * Verifies that an invalid credit card number (Luhn check fails) returns a 200 OK response
     * with `valid: false` and the expected failure message, conforming to the `main.CardResponse` schema.
     * Request body: `{"cardNumber": "1234567890123456"}`
     * Expected response: `{"valid": false, "message": "Invalid card number (Luhn check failed)"}`
     */
    test('should return 200 OK with valid: false for an invalid card number', async ({ request }) => {
        const invalidCardNumber = '1234567890123456';
        const response = await request.post('/api/validate-card', {
            data: { cardNumber: invalidCardNumber },
        });

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.CardResponse');
        expect(body.valid).toBe(false);
        expect(body.message).toContain('Invalid card number (Luhn check failed)');
    });

    /**
     * Verifies that an empty string for `cardNumber` returns a 200 OK response
     * with `valid: false` and the expected failure message, conforming to the `main.CardResponse` schema.
     * Request body: `{"cardNumber": ""}`
     * Expected response: `{"valid": false, "message": "Invalid card number (Luhn check failed)"}`
     */
    test('should return 200 OK with valid: false for an empty card number string', async ({ request }) => {
        const response = await request.post('/api/validate-card', {
            data: { cardNumber: '' },
        });

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.CardResponse');
        expect(body.valid).toBe(false);
        expect(body.message).toContain('Invalid card number (Luhn check failed)');
    });

    /**
     * Verifies that a request with a missing `cardNumber` field returns a 200 OK response
     * with `valid: false` and the expected failure message, conforming to the `main.CardResponse` schema.
     * Request body: `{}`
     * Expected response: `{"valid": false, "message": "Invalid card number (Luhn check failed)"}`
     */
    test('should return 200 OK with valid: false when card number field is missing', async ({ request }) => {
        const response = await request.post('/api/validate-card', {
            data: {}, // Missing cardNumber field
        });

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.CardResponse');
        expect(body.valid).toBe(false);
        expect(body.message).toContain('Invalid card number (Luhn check failed)');
    });

    /**
     * Verifies that sending a non-string type for `cardNumber` (e.g., a number) results in a 400 Bad Request
     * with an error message indicating an invalid request, conforming to the `main.ErrorResponse` schema.
     * Request body: `{"cardNumber": 12345}`
     * Expected response: `{"error": "Invalid request"}`
     */
    test('should return 400 Bad Request for a non-string card number', async ({ request }) => {
        const response = await request.post('/api/validate-card', {
            data: { cardNumber: 12345 }, // cardNumber as a number instead of string
        });

        expect(response.status()).toBe(400);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBe('Invalid request');
    });
});
