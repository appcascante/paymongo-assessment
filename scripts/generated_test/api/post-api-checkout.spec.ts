import { test, expect } from '@playwright/test';
import { assertMatchesSchema } from '../../utils/schema-validator';

test.describe('POST /api/checkout - Process payment checkout', () => {
    /**
     * Verifies that a valid payment request with all required fields
     * is processed successfully, returning a 200 OK status and a
     * response body conforming to the `main.PaymentResponse` schema.
     */
    test('should successfully process a valid payment request', async ({ request }) => {
        const validPaymentPayload = {
            cardNumber: '4242 4242 4242 4242',
            expiry: '12/26',
            cvv: '123',
            amount: 50,
        };

        const response = await request.post('/api/checkout', {
            data: validPaymentPayload,
        });

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.PaymentResponse');
        expect(body.status).toBe('success');
        expect(body.message).toBe('Payment processed successfully!');
    });

    /**
     * Verifies that the endpoint returns 200 OK even when an empty JSON object
     * is sent as the request body, as per known live-app behavior.
     * The response body should still conform to the `main.PaymentResponse` schema.
     */
    test('should return 200 OK for an empty JSON body', async ({ request }) => {
        const emptyPayload = {};

        const response = await request.post('/api/checkout', {
            data: emptyPayload,
        });

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.PaymentResponse');
        expect(body.status).toBe('success');
        expect(body.message).toBe('Payment processed successfully!');
    });

    /**
     * Verifies that the endpoint returns 200 OK even when some or all
     * fields are missing from the `PaymentRequest` body, as per known live-app behavior.
     * The response body should still conform to the `main.PaymentResponse` schema.
     */
    test('should return 200 OK even with missing required fields', async ({ request }) => {
        const partialPayload = {
            expiry: '12/26',
            cvv: '123',
        };

        const response = await request.post('/api/checkout', {
            data: partialPayload,
        });

        expect(response.status()).toBe(200);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.PaymentResponse');
        expect(body.status).toBe('success');
        expect(body.message).toBe('Payment processed successfully!');
    });

    /**
     * Verifies that the endpoint returns a 400 Bad Request status
     * when the `amount` field has an incorrect data type (e.g., string instead of number).
     * The response body should conform to the `main.ErrorResponse` schema
     * and contain a specific error message.
     */
    test('should return 400 Bad Request for an invalid amount type', async ({ request }) => {
        const invalidAmountPayload = {
            cardNumber: '4242 4242 4242 4242',
            expiry: '12/26',
            cvv: '123',
            amount: 'fifty', // Invalid type: string instead of number
        };

        const response = await request.post('/api/checkout', {
            data: invalidAmountPayload,
        });

        expect(response.status()).toBe(400);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBeDefined();
        expect(typeof body.error).toBe('string');
        expect(body.error).toContain('Invalid request');
    });

    /**
     * Verifies that the endpoint returns a 400 Bad Request status
     * when the `expiry` field has an incorrect data type (e.g., number instead of string).
     * The response body should conform to the `main.ErrorResponse` schema
     * and contain a specific error message.
     */
    test('should return 400 Bad Request for an invalid expiry type', async ({ request }) => {
        const invalidExpiryPayload = {
            cardNumber: '4242 4242 4242 4242',
            expiry: 1226, // Invalid type: number instead of string
            cvv: '123',
            amount: 50,
        };

        const response = await request.post('/api/checkout', {
            data: invalidExpiryPayload,
        });

        expect(response.status()).toBe(400);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBeDefined();
        expect(typeof body.error).toBe('string');
        expect(body.error).toContain('Invalid request');
    });

    /**
     * Verifies that the endpoint returns a 400 Bad Request status
     * when the `cvv` field has an incorrect data type (e.g., number instead of string).
     * The response body should conform to the `main.ErrorResponse` schema
     * and contain a specific error message.
     */
    test('should return 400 Bad Request for an invalid cvv type', async ({ request }) => {
        const invalidCvvPayload = {
            cardNumber: '4242 4242 4242 4242',
            expiry: '12/26',
            cvv: 123, // Invalid type: number instead of string
            amount: 50,
        };

        const response = await request.post('/api/checkout', {
            data: invalidCvvPayload,
        });

        expect(response.status()).toBe(400);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBeDefined();
        expect(typeof body.error).toBe('string');
        expect(body.error).toContain('Invalid request');
    });

    /**
     * Verifies that the endpoint returns a 400 Bad Request status
     * when the `cardNumber` field has an incorrect data type (e.g., number instead of string).
     * The response body should conform to the `main.ErrorResponse` schema
     * and contain a specific error message.
     */
    test('should return 400 Bad Request for an invalid cardNumber type', async ({ request }) => {
        const invalidCardNumberPayload = {
            cardNumber: 4242424242424242, // Invalid type: number instead of string
            expiry: '12/26',
            cvv: '123',
            amount: 50,
        };

        const response = await request.post('/api/checkout', {
            data: invalidCardNumberPayload,
        });

        expect(response.status()).toBe(400);

        const body = await response.json() as Record<string, unknown>;
        assertMatchesSchema(body, 'main.ErrorResponse');
        expect(body.error).toBeDefined();
        expect(typeof body.error).toBe('string');
        expect(body.error).toContain('Invalid request');
    });
});
