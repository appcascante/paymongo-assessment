You are a senior SDET and TypeScript engineer generating a Playwright end-to-end test for a Next.js checkout page.

Generate one complete Playwright spec file that exercises the checkout form using only stable selectors that have been extracted from the real source.

## Output contract

- Output TypeScript only. Do not include markdown fences, explanations, or surrounding prose.
- The first line must be exactly: `import { test, expect } from '@playwright/test';`
- Use only Playwright's `page` fixture. Do not import custom helpers or third-party libraries.
- Navigate with `await page.goto('/')`. Playwright's `baseURL` is already configured to the frontend URL.
- Do not call any absolute URL such as `http://localhost:3000` or `http://localhost:8080`.
- Do not invoke API endpoints directly with `request.*`. This is a UI test; the form makes the API calls.
- Do not use `test.only`, `test.describe.only`, `test.skip`, `page.waitForTimeout`, or arbitrary sleeps.
- Use only the auto-waiting locator API (`page.locator(...)`, `getByRole`, `getByText`) and `await expect(...)` assertions.
- Include at least three meaningful `expect(...)` assertions in the generated file.
- Keep tests independent, deterministic, and safe to run in parallel.

## TypeScript coding standard

- Strict types, descriptive names, `const` by default, no `any`, no unused imports, no implicit globals.
- Keep the code clean and simple. Avoid abstractions unless they materially improve readability.
- Add a detailed JSDoc summary comment immediately above each `test(...)` block describing the user scenario and the expected UI outcome.

## Required selector strategy

Follow Playwright's official locator priority order, with one app-specific override documented below. For each interactive element, attempt locators in this order and use the **first one that is correct and unambiguous** for the element:

1. **`page.getByRole(role, { name })`** — preferred for any element with an implicit ARIA role: buttons, links, headings, checkboxes, radios, dialogs, etc. Use this for the submit button.
2. **`page.getByLabel(text)`** — preferred for form inputs whose visible label is programmatically associated via `<label htmlFor>` or `aria-labelledby`. **DO NOT USE in this app** (see override below).
3. **`page.getByPlaceholder(text)`** — acceptable for inputs that have a stable, unique `placeholder` attribute when label association is missing.
4. **`page.getByText(text)`** — preferred for asserting visible, non-interactive text such as success messages, error banners, and inline validation copy.
5. **`page.getByAltText(text)`** — for images with stable `alt` attributes.
6. **`page.getByTitle(text)`** — for elements with a stable `title` attribute.
7. **`page.getByTestId(id)`** — only when a `data-testid` is present in the source.
8. **`page.locator(cssSelector)` with attribute selectors** — last resort, and only with **stable, semantic** attributes such as `name`, `type`, `role`. Never select by class name, nth-child, sibling chains, or visual styling.

### App-specific override

The visible `<label>` elements on this checkout page are NOT programmatically associated with their `<input>` elements (no `htmlFor`, no `aria-labelledby`). Therefore:

- `getByLabel` will fail at runtime for every form field. **Do not use `getByLabel` anywhere in the generated spec.**
- For each form `<input>`, fall back to step 8 with `page.locator('input[name="..."]')` using the exact `name` attribute values listed in the extracted selectors below. The `name` attribute is the most stable signal available on this page.
- For the submit button, use step 1: `page.getByRole('button', { name: /Pay|Complete Payment/i })`. The button text is dynamic (`Complete Payment` when amount is empty, `Pay $<amount>` when filled, `Processing Payment...` mid-request), so the regex must accommodate the idle and amount-filled states.
- For success and error assertions, use step 4: `await expect(page.getByText(/.../)).toBeVisible()`. The success path renders text starting with `✅`, and the failure path renders text starting with `❌`.
- **Two `✅`-prefixed strings can be on the page at once**: the inline card validation hint `✅ Valid card number (Luhn check passed)` and the post-submit banner `✅ <message>` from the checkout response. **Never assert a bare emoji regex** like `/✅/` or `/❌/` — Playwright strict mode will fail on multiple matches. Always include disambiguating words after the emoji, for example `/✅ Payment/` for the submit success banner and `/✅ Valid card number/` for the inline Luhn hint.
- **Do not invent or hardcode the exact API success message text** (e.g. `Payment successful`, `Payment complete`). The success banner format is `✅ <message-from-API>` and the message body comes from the backend response and is not guaranteed. Assert only on the stable `✅ Payment` prefix or use a regex that tolerates trailing text such as `/✅ Payment[\s\S]+/i`.

### General selector hygiene

- Always assert visibility (`await expect(locator).toBeVisible()`) before interacting with an element when the element appears conditionally.
- Never chain CSS descendants more than one level deep. Prefer a single attribute selector over `div.x > div.y > input`.
- Never select by Tailwind utility classes such as `bg-purple-500` — they are styling and will churn.
- Never use `nth-child`, `nth-of-type`, or positional indexing.
- Never invent `data-testid` values that do not exist in the extracted source.
- Never construct locators dynamically from user-controlled or random data.
- Use one locator per concern; do not store an intermediate locator and chain unrelated assertions through it.

## Extracted selectors and field metadata

```json
{{SELECTORS_JSON}}
```

## Known live-app behavior that overrides optimistic assumptions

{{KNOWN_FACTS}}

## Required scenarios

Generate, at minimum, these `test(...)` blocks inside a single `test.describe('Checkout page', () => { ... })`:

1. **Renders the checkout form** — navigates to `/`, asserts each named input is visible, and asserts the submit button is visible.
2. **Successful payment with a Luhn-valid card** — fills the form with a known-valid card (`4242 4242 4242 4242` or `4242424242424242` — both are accepted because the UI auto-formats), expiry `12/26`, cvv `123`, amount `50`, email `test@example.com`. After submitting, asserts the post-submit banner `/✅ Payment[\s\S]*/i` is visible. **Do NOT assert the inline `✅ Valid card number` hint in this test** — that hint only appears after the card field is blurred, and adding a blur step here makes the test brittle. The post-submit success banner alone is sufficient evidence the happy path worked.
3. **Card validation failure on blur** — fills `cardNumber` with `1234567890123456`, blurs the field, and asserts the inline `❌ Invalid card number` message becomes visible without submitting the form.
4. **Submit blocked when card is invalid (negative path)** — fills every required field but uses an invalid Luhn card such as `1234567890123456`, blurs the card field so the inline `❌ Invalid card number` hint renders, then submits the form. Assert that the post-submit banner `❌ Please enter a valid card number` becomes visible. This negative test verifies the client-side submit guard prevents a failed-validation card from reaching the API.

Generate exactly four tests.

## Few-shot style example

```ts
import { test, expect } from '@playwright/test';

test.describe('Checkout page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    /**
     * Verifies that the checkout form renders all required inputs and the submit control on initial load.
     */
    test('renders the checkout form', async ({ page }) => {
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="cardNumber"]')).toBeVisible();
        await expect(page.getByRole('button', { name: /Complete Payment|Pay/i })).toBeVisible();
    });
});
```

Now generate the complete TypeScript spec file for the supplied checkout page.
