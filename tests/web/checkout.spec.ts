import { test, expect } from '@playwright/test';

test.describe('Checkout page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    /**
     * Verifies that the checkout form renders all required input fields and the submit button on initial page load.
     */
    test('renders the checkout form', async ({ page }) => {
        // Assert visibility of all required input fields using their 'name' attribute
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="cardNumber"]')).toBeVisible();
        await expect(page.locator('input[name="expiry"]')).toBeVisible();
        await expect(page.locator('input[name="cvv"]')).toBeVisible();
        await expect(page.locator('input[name="amount"]')).toBeVisible();

        // Assert visibility of the submit button, accommodating its dynamic text
        await expect(page.getByRole('button', { name: /Pay|Complete Payment/i })).toBeVisible();
    });

    /**
     * Tests a successful payment flow by filling the form with valid data and asserting the success message.
     * This scenario uses a Luhn-valid card number and expects a post-submit success banner.
     */
    test('successful payment with a Luhn-valid card', async ({ page }) => {
        // Fill out the form fields with valid data
        await page.locator('input[name="email"]').fill('test@example.com');
        await page.locator('input[name="cardNumber"]').fill('4242424242424242'); // Luhn-valid card, auto-formats
        await page.locator('input[name="expiry"]').fill('12/26'); // Auto-formats
        await page.locator('input[name="cvv"]').fill('123');
        await page.locator('input[name="amount"]').fill('50');

        // Click the submit button. The button text will dynamically change (e.g., "Pay $50").
        await page.getByRole('button', { name: /Pay|Complete Payment/i }).click();

        // Assert that the post-submit success banner is visible.
        // The message content comes from the API, so we assert on the stable prefix.
        await expect(page.getByText(/✅ Payment[\s\S]+/i)).toBeVisible();
    });

    /**
     * Verifies that client-side card validation triggers an inline error message on blur
     * when an invalid Luhn card number is entered, without submitting the form.
     */
    test('card validation failure on blur', async ({ page }) => {
        const cardNumberInput = page.locator('input[name="cardNumber"]');
        const emailInput = page.locator('input[name="email"]'); // Use another input to trigger blur

        // Fill the card number field with an invalid Luhn sequence
        await cardNumberInput.fill('1234567890123456');

        // Blur the card number field to trigger client-side validation
        await emailInput.click(); // Clicking another input blurs the current one

        // Assert that the inline invalid card number message becomes visible
        await expect(page.getByText(/❌ Invalid card number/i)).toBeVisible();

        // Ensure the post-submit success banner is NOT visible, confirming no submission occurred
        await expect(page.getByText(/✅ Payment[\s\S]+/i)).not.toBeVisible();
    });

    /**
     * Tests the negative path where the form is submitted with an invalid Luhn card number.
     * This scenario verifies that client-side validation prevents a successful submission
     * and displays a post-submit error banner.
     */
    test('submit blocked when card is invalid (negative path)', async ({ page }) => {
        const cardNumberInput = page.locator('input[name="cardNumber"]');
        const emailInput = page.locator('input[name="email"]'); // Use another input to trigger blur

        // Fill out all required fields, but with an invalid card number
        await emailInput.fill('test@example.com');
        await cardNumberInput.fill('1234567890123456'); // Invalid Luhn card
        await page.locator('input[name="expiry"]').fill('12/26');
        await page.locator('input[name="cvv"]').fill('123');
        await page.locator('input[name="amount"]').fill('50');

        // Blur the card number field to trigger client-side validation
        await emailInput.click();

        // Assert that the inline invalid card number message is visible before attempting submission
        await expect(page.getByText(/❌ Invalid card number/i)).toBeVisible();

        // Click the submit button
        await page.getByRole('button', { name: /Pay|Complete Payment/i }).click();

        // Assert that the post-submit error banner for an invalid card number is visible
        await expect(page.getByText(/❌ Please enter a valid card number/i)).toBeVisible();

        // Ensure the post-submit success banner is NOT visible
        await expect(page.getByText(/✅ Payment[\s\S]+/i)).not.toBeVisible();
    });
});
