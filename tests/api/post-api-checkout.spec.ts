import { test, expect } from '@playwright/test';
import { assertMatchesSchema } from '../../utils/schema-validator';

test.describe('POST /api/checkout - Process payment checkout', () => {
    /**
     * Verifies that a valid payment request is processed successfully,
     * returning a 200 OK status and a response body conforming to the
     * `main.PaymentResponse` schema with expected success details.
     *
     * Request: A complete `main.PaymentRequest` object with valid card details.
     * Expected: Status 200, `status: "success"`, `message: "Payment processed successfully!"`.
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
     * is sent as the request body, based on known mock implementation behavior.
     * The response should still conform to the `main.PaymentResponse` schema.
     *
     * Request: An empty JSON object `{}`.
     * Expected: Status 200, `status: "success"`, `message: "Payment processed successfully!"`.
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
     * Verifies that the endpoint returns 200 OK even when required fields
     * are missing from the request body, based on known mock implementation behavior.
     * The response should still conform to the `main.PaymentResponse` schema.
     *
     * Request: A `main.PaymentRequest` object with `cardNumber` and `amount` missing.
     * Expected: Status 200, `status: "success"`, `message: "Payment processed successfully!"`.
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
     * Verifies that the endpoint returns a 400 Bad Request status when the `amount`
     * field has an incorrect data type (e.g., string instead of number).
     * The response body should conform to the `main.ErrorResponse` schema and
     * contain an "Invalid request" message.
     *
     * Request: `main.PaymentRequest` with `amount` as a string.
     * Expected: Status 400, `error` message containing "Invalid request".
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
     * Verifies that the endpoint returns a 400 Bad Request status when the `expiry`
     * field has an incorrect data type (e.g., number instead of string).
     * The response body should conform to the `main.ErrorResponse` schema and
     * contain an "Invalid request" message.
     *
     * Request: `main.PaymentRequest` with `expiry` as a number.
     * Expected: Status 400, `error` message containing "Invalid request".
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
});
