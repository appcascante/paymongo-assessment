import { test, expect } from '@playwright/test';
import { assertMatchesSchema } from '../../utils/schema-validator';

test.describe('POST /api/validate-card - Card number validation', () => {
    /**
     * Verifies that a valid credit card number (passing Luhn check) returns a successful
     * validation response with `valid: true` and the expected message.
     * The response body should conform to the `main.CardResponse` Swagger schema.
     */
    test('should return valid for a known valid card number', async ({ request }) => {
        const validCardNumber = '4242424242424242';
        const response = await request.post('/api/validate-card', {
            data: { cardNumber: validCardNumber },
        });

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.CardResponse');
        expect(body.valid).toBe(true);
        expect(body.message).toBe('Card number validated');
    });

    /**
     * Verifies that an invalid credit card number (failing Luhn check) returns a
     * validation response with `valid: false` and the appropriate error message.
     * The response body should conform to the `main.CardResponse` Swagger schema.
     */
    test('should return invalid for a known invalid card number (Luhn check failed)', async ({ request }) => {
        const invalidCardNumber = '1234567890123456';
        const response = await request.post('/api/validate-card', {
            data: { cardNumber: invalidCardNumber },
        });

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.CardResponse');
        expect(body.valid).toBe(false);
        expect(body.message).toBe('Invalid card number (Luhn check failed)');
    });

    /**
     * Verifies that sending a request with a missing `cardNumber` field in the body
     * still results in a 200 OK response, but with `valid: false` due to the Luhn check failure.
     * The response body should conform to the `main.CardResponse` Swagger schema.
     */
    test('should return invalid when the cardNumber field is missing', async ({ request }) => {
        const response = await request.post('/api/validate-card', {
            data: {}, // Missing cardNumber field
        });

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.CardResponse');
        expect(body.valid).toBe(false);
        expect(body.message).toBe('Invalid card number (Luhn check failed)');
    });

    /**
     * Verifies that sending an empty string for `cardNumber` results in a 200 OK response,
     * but with `valid: false` due to the Luhn check failure.
     * The response body should conform to the `main.CardResponse` Swagger schema.
     */
    test('should return invalid when the cardNumber field is an empty string', async ({ request }) => {
        const response = await request.post('/api/validate-card', {
            data: { cardNumber: '' },
        });

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.CardResponse');
        expect(body.valid).toBe(false);
        expect(body.message).toBe('Invalid card number (Luhn check failed)');
    });

    /**
     * Verifies that sending a `cardNumber` field with a non-string type (e.g., a number)
     * results in a 400 Bad Request response, indicating a JSON decoding error.
     * The response body should conform to the `main.ErrorResponse` Swagger schema.
     */
    test('should return 400 Bad Request when cardNumber is a non-string type', async ({ request }) => {
        const response = await request.post('/api/validate-card', {
            data: { cardNumber: 12345 }, // cardNumber as a number instead of string
        });

        expect(response.status()).toBe(400);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBe('Invalid request');
    });
});
