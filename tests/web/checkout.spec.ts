import { test, expect } from '@playwright/test';

test.describe('Checkout page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    /**
     * Verifies that the checkout form renders all required inputs and the submit control on initial load.
     * Asserts the visibility of each input field by its 'name' attribute and the submit button by its role and name.
     */
    test('renders the checkout form', async ({ page }) => {
        // Assert visibility of all required input fields
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="cardNumber"]')).toBeVisible();
        await expect(page.locator('input[name="expiry"]')).toBeVisible();
        await expect(page.locator('input[name="cvv"]')).toBeVisible();
        await expect(page.locator('input[name="amount"]')).toBeVisible();

        // Assert visibility of the submit button
        await expect(page.getByRole('button', { name: /Complete Payment|Pay/i })).toBeVisible();
    });

    /**
     * Simulates a successful payment transaction by filling the form with valid data
     * and asserting the appearance of a success banner after submission.
     * This test uses a Luhn-valid card number and verifies the end-to-end success path.
     */
    test('successful payment with a Luhn-valid card', async ({ page }) => {
        // Fill in the email address
        await page.locator('input[name="email"]').fill('test@example.com');

        // Fill in a Luhn-valid card number. The UI auto-formats spaces.
        await page.locator('input[name="cardNumber"]').fill('4242424242424242');

        // Fill in the expiry date. The UI auto-formats the slash.
        await page.locator('input[name="expiry"]').fill('1226');

        // Fill in the CVV
        await page.locator('input[name="cvv"]').fill('123');

        // Fill in the amount
        await page.locator('input[name="amount"]').fill('50');

        // Click the submit button. The button text will dynamically change to "Pay $50.00" or similar.
        await page.getByRole('button', { name: /Pay|Complete Payment/i }).click();

        // Assert that the success banner is visible. The message content is dynamic from the API.
        await expect(page.getByText(/✅ Payment[\s\S]+/i)).toBeVisible();
    });

    /**
     * Verifies that client-side card validation correctly identifies an invalid Luhn card
     * and displays an inline error message upon blurring the card number field, without submitting the form.
     */
    test('card validation failure on blur', async ({ page }) => {
        const cardNumberInput = page.locator('input[name="cardNumber"]');

        // Fill in an invalid Luhn card number
        await cardNumberInput.fill('1234567890123456');

        // Blur the input field to trigger validation
        await cardNumberInput.blur();

        // Assert that the inline invalid card number message becomes visible
        await expect(page.getByText(/❌ Invalid card number/i)).toBeVisible();

        // Ensure the success banner is NOT visible, confirming no submission occurred
        await expect(page.getByText(/✅ Payment[\s\S]+/i)).not.toBeVisible();
    });

    /**
     * Verifies that the form submission is blocked when an invalid card number is provided,
     * and an appropriate error message is displayed after attempting to submit.
     * This tests the client-side submit guard for invalid card data.
     */
    test('submit blocked when card is invalid (negative path)', async ({ page }) => {
        const cardNumberInput = page.locator('input[name="cardNumber"]');

        // Fill in all required fields
        await page.locator('input[name="email"]').fill('test@example.com');
        await cardNumberInput.fill('1234567890123456'); // Invalid Luhn card
        await page.locator('input[name="expiry"]').fill('1226');
        await page.locator('input[name="cvv"]').fill('123');
        await page.locator('input[name="amount"]').fill('50');

        // Blur the card number field to trigger inline validation and render the error hint
        await cardNumberInput.blur();
        await expect(page.getByText(/❌ Invalid card number/i)).toBeVisible();

        // Attempt to submit the form
        await page.getByRole('button', { name: /Pay|Complete Payment/i }).click();

        // Assert that the post-submit error banner for invalid card number is visible
        await expect(page.getByText(/❌ Please enter a valid card number/i)).toBeVisible();

        // Assert that a success banner is NOT visible
        await expect(page.getByText(/✅ Payment[\s\S]+/i)).not.toBeVisible();
    });
});
