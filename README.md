# AI-Driven Playwright Test Generation & CI Quality Gate

This repository is my submission for the AI-driven API automation & CI gating challenge. An LLM (Google Gemini) reads the app's Swagger contract and frontend source, generates Playwright API and E2E tests on demand, and a GitHub Actions workflow runs them as a PR quality gate.

The Playwright **configuration template** (`playwright.config.ts`) is **unmodified**, per the assessment rules. The wider scaffold (`tests/`, `utils/`, `page-objects/`, `config/`) is also untouched apart from one new helper, [utils/schema-validator.ts](utils/schema-validator.ts), which generated tests import for runtime Swagger-schema validation. All generation logic lives under [scripts/](scripts/) and writes generated specs into [tests/api/](tests/api/) and [tests/web/](tests/web/) so the existing config picks them up.

> ### ⚠️ Read first — assessment PDF vs. real app mismatch
>
> The PDF describes a checkout flow with **shipping name** and **shipping address** fields. **Those fields do not exist in the actual app.** The real `app/page.tsx` form has `email + cardNumber + expiry + cvv + amount`. The E2E generator works against the real DOM (selectors extracted from source — see [docs/phase1-recon.md](docs/phase1-recon.md)) and asserts the real success state `"✅ Payment processed successfully!"`. I flagged this rather than papering over it, since silently "testing" non-existent fields would be the worst possible outcome for a quality gate.
>
> ### 📁 Layout note
>
> The PDF's suggested layout puts `generated_test/` at the repo root. I keep the **source-of-truth generated specs** under [scripts/generated_test/](scripts/generated_test/) and **mirror them into [tests/](tests/)** at write time. Reason: the template's `playwright.config.ts` has `testDir: './tests'` and **must not be modified** — mirroring is the only way to keep the LLM output discoverable by the unmodified config without touching it.

---

## Repository layout

```
paymongo-assessment/
├── README.md                              ← this write-up
├── playwright.config.ts                   ← template, untouched
├── tests/
│   ├── api/                               ← runnable copies of generated API specs
│   └── web/                               ← runnable copy of generated E2E spec
├── scripts/
│   ├── generate-api-tests.ts              ← Swagger → Gemini → Playwright API tests
│   ├── generate-e2e-tests.ts              ← page.tsx selectors → Gemini → E2E test
│   ├── gate.ts                            ← local quality-gate orchestrator (also CMD of Dockerfile)
│   ├── start-app.ts / stop-app.ts         ← boot/teardown for backend + frontend
│   ├── github_action.yaml                 ← CI workflow (native + docker dispatch)
│   ├── prompts/
│   │   ├── api-test.prompt.md             ← system prompt for API generation
│   │   └── e2e-test.prompt.md             ← system prompt for E2E generation
│   ├── common-libs/                       ← Gemini client, cache, tsc compile gate, writer
│   ├── generate-api-libs/                 ← Swagger 2.0 parser, prompt builder, validator
│   ├── generate-e2e-libs/                 ← page.tsx selector extractor, validator
│   └── generated_test/                    ← source-of-truth generated specs (mirrored into tests/)
├── Dockerfile / .dockerignore             ← reproducible local + CI runtime image
├── docs/
│   └── phase1-recon.md                    ← endpoint + selector reconnaissance notes
└── GAME_PLAN.md                           ← phased plan I executed against
```

---

## Quick start (local)

```bash
# 1. Install
npm ci
npx playwright install --with-deps chromium

# 2. Configure (the only required secret is GEMINI_API_KEY)
cp .env.example .env
# edit .env → GEMINI_API_KEY=...

# 3. Boot the app under test (Go API on :8080, Next.js UI on :3000)
npm run app:start

# 4. Generate tests from Swagger + frontend source
npm run generate                           # both API + E2E (cached: skips unchanged specs)
# or individually:
#   npm run generate:api                   # → tests/api/*.spec.ts
#   npm run generate:web                   # → tests/web/checkout.spec.ts

# 5. Run the suite
npm test
npm run report                             # open the HTML report

# 6. Tear down
npm run app:stop

# Or do all of the above in one shot:
npm run gate                               # start → generate → test → stop
```

The generators are **deterministic and cached**: a SHA-256 of (model name + final prompt) is stored in [scripts/generated_test/.cache.json](scripts/generated_test/.cache.json). Reruns with an unchanged Swagger / page source skip Gemini entirely, so CI does not pay the API cost on every PR.

### Run the gate in Docker locally

If you'd rather use the same image CI builds (Playwright v1.40.0-jammy + Go 1.21), the project [Dockerfile](Dockerfile) wraps `npm run gate` as the default `CMD`:

```powershell
# From C:\Users\appca\source\repos (parent of both repos)
docker build -t paymongo-gate:local .\paymongo-assessment

$env:GEMINI_API_KEY = "<your key>"
docker run --rm `
  -v "${PWD}\paymongo-assessment:/app" `
  -v /app/node_modules `
  -v "${PWD}\paymongo-assessment-app-code:/app-code" `
  -v /app-code/node_modules `
  -v /app-code/.next `
  -w /app `
  -e APP_CODE_DIR=/app-code `
  -e STAGING_API_URL=http://localhost:8080 `
  -e STAGING_BASE_URL=http://localhost:3000 `
  -e TEST_ENV=staging `
  -e GEMINI_MODEL=gemini-2.5-flash-lite `
  -e GEMINI_API_KEY `
  -e CI=true `
  paymongo-gate:local `
  bash -lc "npm ci && (cd /app-code && (test -f package-lock.json && npm ci || npm install --no-audit --no-fund)) && npm run gate"
```

The container boots its own backend + frontend on `localhost:8080` / `:3000` *inside* itself, so no host networking or port mapping is required.

---

## Required write-up — 9 questions

### 1. Prompt design

Both generators share a four-part structure (see [api-test.prompt.md](scripts/prompts/api-test.prompt.md) and [e2e-test.prompt.md](scripts/prompts/e2e-test.prompt.md)):

1. **System role** — *"You are a senior SDET and TypeScript engineer generating Playwright tests…"* anchors style, seniority, and language.
2. **Output contract** — hard rules the validator also enforces: first line must be `import { test, expect } from '@playwright/test';`, no `test.only` / `test.skip`, no absolute URLs, no sleeps, minimum assertion count, relative paths only, no third-party imports.
3. **Coding & Playwright standards** — strict types, no `any`, JSDoc on every `test(...)`, `getByRole` for buttons, `await expect(...).toBeVisible()` before action, parallel-safe & deterministic.
4. **Injected ground truth** — the API prompt receives the actual endpoint JSON (`{{ENDPOINT_JSON}}`) plus a `{{KNOWN_FACTS}}` block describing live-app quirks (e.g. `/api/validate-email` always 500). The E2E prompt receives `{{SELECTORS_JSON}}` extracted from `app/page.tsx` and the same known-facts block.

Determinism: Gemini is called with `temperature: 0`, `topP: 0` (see [scripts/common-libs/gemini.ts](scripts/common-libs/gemini.ts)). On validation failure, a structured **retry prompt** is built that quotes the original prompt plus the validator errors, so the model fixes its previous output rather than re-rolling.

### 2. From Swagger → tests

Pipeline implemented in [scripts/generate-api-tests.ts](scripts/generate-api-tests.ts):

1. **Read** `paymongo-assessment-app-code/docs/swagger.json` (Swagger 2.0 — note `definitions`, not `components/schemas`).
2. **Parse & extract** each `(method, path)` operation into a typed `EndpointContext` ([scripts/generate-api-libs/swagger.ts](scripts/generate-api-libs/swagger.ts)) carrying parameters, request schema, response schemas, and a derived `fileName` like `post-api-checkout.spec.ts`.
3. **Build a per-endpoint prompt** by template-filling the system prompt with that endpoint's JSON plus the `KNOWN_FACTS` block.
4. **Cache check** — if the SHA-256 of `(modelName + prompt)` matches the cache and both output files still exist, skip.
5. **Call Gemini**, strip code fences, run **validation** (static checks + `tsc --noEmit`), and on failure feed the errors into a repair prompt up to `maxRetries` times.
6. **Write** the spec to [scripts/generated_test/api/](scripts/generated_test/api/) (source of truth) and copy it into [tests/api/](tests/api/) so the unmodified `playwright.config.ts` picks it up via the existing `api-tests` project.

One spec per endpoint — generation is naturally parallelizable per file.

### 3. Generation flow

```
                           ┌────────────────────────┐
                           │ swagger.json /         │
                           │ app/page.tsx           │
                           └────────────┬───────────┘
                                        │ parse / extract
                                        ▼
                       ┌────────────────────────────────┐
                       │ EndpointContext / Selectors    │
                       └────────────────┬───────────────┘
                                        │
       prompt template ────► fillPromptTemplate ────► final prompt
                                        │
                                        ▼
                              SHA-256 cache check ───────► skip (no API cost)
                                        │ miss
                                        ▼
                                ┌────────────────┐
                                │ Gemini (temp=0)│
                                └───────┬────────┘
                                        │ raw TS
                                        ▼
                           strip code-fence + validate
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │ static checks                 │ tsc --noEmit (strict)         │
        │ • import line exact           │ • compile in isolated tmp dir │
        │ • no test.only / .skip        │                               │
        │ • no absolute URLs            │                               │
        │ • ≥ N expect()                │                               │
        │ • paths ⊆ swagger paths       │                               │
        │ • selectors ⊆ extracted set   │                               │
        └───────────────────────────────┴───────────────────────────────┘
                                        │ errors? → feed back into retry prompt
                                        ▼ pass
                       write scripts/generated_test/{api,web}/*.spec.ts
                       mirror into tests/{api,web}/*.spec.ts
                       update .cache.json
                                        │
                                        ▼
                                 npm test (Playwright)
```

### 4. CI quality gate

[scripts/github_action.yaml](scripts/github_action.yaml) runs on every `pull_request` to `main` / `master`, and exposes a **`workflow_dispatch` `runtime` choice input** so the same workflow can be executed in two interchangeable ways:

| Job | Trigger | Purpose |
|---|---|---|
| `test-native` | `push` / `pull_request`, or manual dispatch with `runtime=native` (default) | Fast path on `ubuntu-latest` with `setup-go` + `setup-node` directly. Cheap on CI minutes, what every PR actually runs. |
| `test-docker` | Manual dispatch with `runtime=docker` | Builds the project [Dockerfile](Dockerfile) (Playwright v1.40.0-jammy + Go 1.21) with GHA layer cache, then runs `npm run gate` *inside* the image. Demonstrates a fully reproducible CI image identical to the one developers run locally. |

Mutually-exclusive `if:` guards mean exactly one job ever runs per dispatch; artifacts are suffixed `-native` / `-docker` so they never collide. Common steps for both jobs:

1. Checkout this repo and the app-under-test repo side-by-side.
2. Set up the runtime (native: `setup-go@v5` + `setup-node@v4`; docker: `docker/setup-buildx-action@v3` + `docker/build-push-action@v6` with `cache-from/to: type=gha`).
3. `npm ci` + (native only) `npx playwright install --with-deps chromium` — the Docker image already ships browsers.
4. `npm run gate` — the single orchestrator in [scripts/gate.ts](scripts/gate.ts) that boots the app, regenerates LLM specs (cache hits skip Gemini), runs the suite, and tears down — guaranteeing identical local and CI behavior.
5. Always upload `playwright-report/`, `test-results/results.xml`, and on failure `scripts/.app-logs/` as artifacts (retention 14 / 14 / 7 days).

The job's exit code is the Playwright exit code, so a failing test fails the check. Pair it with a **branch-protection rule** marking *Generate & Run Tests (native)* as a required status check — that's what actually blocks merges. The Docker job stays opt-in so PRs aren't paying full image-build cost on every push.

### 5. Scaling to dozens of endpoints / engineers

- **One file per endpoint, one prompt per endpoint.** No giant prompt that grows with the API; token cost stays bounded per spec.
- **Per-spec prompt-hash cache** ([scripts/common-libs/cache.ts](scripts/common-libs/cache.ts)) — only changed endpoints regenerate. Adding 50 endpoints with no Swagger churn = 0 LLM calls.
- **Concurrent generation** ([scripts/common-libs/concurrency.ts](scripts/common-libs/concurrency.ts)) — the API generator processes endpoints in parallel up to `GENERATOR_CONCURRENCY` (default 4). Each compile-check runs in an isolated, uniquely-named candidate file so parallel jobs cannot collide.
- **Rate-limit resilience** — the Gemini client retries 429 / 5xx / network errors with exponential backoff + jitter (`GEMINI_MAX_ATTEMPTS`, `GEMINI_BACKOFF_BASE_MS`), so concurrent generation does not blow up on transient throttles.
- **Sharded test execution** — Playwright supports `--shard=i/N`; the CI job can be matrixed by shard for many specs.
- **Prompt template is data, not code** — non-engineers can tune wording in `scripts/prompts/*.md` without touching TypeScript.
- **Per-tag scoping** — Swagger tags can be used to split prompts further (e.g. one generator invocation per tag), keeping each prompt small.
- **Dockerized CI** — a [Dockerfile](Dockerfile) based on `mcr.microsoft.com/playwright:v1.40.0-jammy` skips the `playwright install --with-deps` step and pins the runtime, so CI builds are fast and reproducible across hosts.

### 6. Defending against hallucinations

Layered, all enforced before a file is written and at runtime:

1. **Static text guardrails** ([generate-api-libs/validation.ts](scripts/generate-api-libs/validation.ts), [generate-e2e-libs/validation.ts](scripts/generate-e2e-libs/validation.ts)) — exact import line, no `test.only` / `test.skip`, no absolute URLs, no `waitForTimeout` / `setTimeout`, minimum `expect()` count, no `page` / `browser` in API specs, no direct `request.*` in E2E specs.
2. **Path / selector allow-list** — the API validator checks every URL literal in the generated code against `Set<swagger.paths>`, and **requires the path argument to be an inline string literal** (not a `const` variable or interpolated template) so the static check is meaningful. The E2E validator checks every `input[name="…"]` against the selectors actually extracted from `page.tsx`. The model **cannot invent endpoints or fields** without being rejected.
3. **TypeScript compile gate** ([common-libs/compiler.ts](scripts/common-libs/compiler.ts)) — runs `tsc --noEmit --strict` on each candidate by writing it to a hidden `.tscheck.ts` file inside the runnable test dir, so relative imports + `node_modules` resolution match runtime exactly. Bad imports, syntax errors, and unsafe casts fail validation.
4. **Schema-aware runtime assertions** ([utils/schema-validator.ts](utils/schema-validator.ts)) — the prompt requires generated API specs to call `assertMatchesSchema(body, '<DefinitionName>')` for every documented success-path response that references a Swagger `$ref`. The helper compiles the actual Swagger definition with `ajv` and validates the live response body, so even if the LLM hallucinates a field in a hand-written `expect(...)`, the schema check fails on contract drift first. This converts the Swagger contract into a runtime contract.
5. **Bounded repair loop with exponential backoff** ([common-libs/gemini.ts](scripts/common-libs/gemini.ts)) — validator errors are fed back into a structured retry prompt up to `maxRetries` times. Transient Gemini failures (HTTP 429 rate limit, 5xx, network) are retried separately with exponential backoff + jitter (`GEMINI_MAX_ATTEMPTS`, `GEMINI_BACKOFF_BASE_MS`). After both budgets are exhausted the generator throws and CI fails loudly rather than silently writing junk.
6. **Known-quirks block** in the prompt — facts that contradict the Swagger optimism (e.g. `/api/validate-email` always returns 500) are stated explicitly so the model doesn't invent passing 200 assertions.
7. **Determinism** — `temperature: 0`, `topP: 0`, prompt-hash cache. The same input always produces the same output, so review is meaningful and CI is reproducible.

### 7. Flake handling

- **Retries on CI only** — `playwright.config.ts` already sets `retries: 2` when `process.env.CI` is set; locally retries are 0 to surface flakes immediately.
- **Auto-waiting locators only** — the prompt forbids `waitForTimeout` and the validator rejects it. All assertions go through `await expect(...)` which retries until timeout.
- **`trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`** — every failure ships a debuggable artifact.
- **Soft-fail awareness** — the email endpoint intentionally returns 500. The known-facts block tells the model to assert `expect(response.status()).toBe(500)` rather than treating intermittent 500s as a bug.
- **Quarantine path** — failing-but-non-blocking specs can be tagged `@quarantine` and excluded via `--grep-invert`. (Hook is in place; nothing currently quarantined.)
- **Independent + parallel-safe tests** — required by the prompt; the generator does not produce shared state across `test()` blocks, so flake from cross-test interference is structurally eliminated.

### 8. E2E selector strategy

The Next.js checkout page has a quirk: visible `<label>` elements are **not** programmatically associated with their inputs (no `htmlFor`, no `aria-labelledby`). Naive `getByLabel(...)` returns zero matches. See [docs/phase1-recon.md](docs/phase1-recon.md).

Approach:

1. **Extract real selectors from source** ([scripts/generate-e2e-libs/selectors.ts](scripts/generate-e2e-libs/selectors.ts)) — a small AST/regex pass over `app/page.tsx` produces `{ inputs: [{ name, placeholder }], buttons: [{ name }] }`. The LLM is given the actual selector inventory rather than being asked to guess.
2. **Locator priority order** baked into the prompt, mirroring Playwright's official guidance: `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByAltText` / `getByTitle` / `getByTestId` → `page.locator(cssSelector)` only as a last resort with stable attributes.
3. **App-specific override** — the prompt explicitly forbids `getByLabel` for this app and prescribes `page.locator('input[name="…"]')` for fields and `getByRole('button', { name: /…/ })` for the submit button.
4. **Validator enforces the inventory** — every `input[name="X"]` literal in the generated code must appear in the extracted selector set, otherwise the spec is rejected.
5. **Visibility-before-action** — the prompt requires `await expect(locator).toBeVisible()` before clicking / filling, plus a final `await expect(page.getByText(/payment processed successfully/i)).toBeVisible()` to assert the success state.

### 9. Frontend flake prevention

- **No `waitForTimeout`, no `setTimeout`** — banned by the prompt and rejected by the validator. Locators auto-wait up to `actionTimeout: 15_000` ms (set in `playwright.config.ts`).
- **Web-first assertions** — `await expect(locator).toBeVisible()` / `.toHaveText(...)` retry against the live DOM, so they ride out async re-renders without arbitrary sleeps.
- **`page.goto('/')` only** — `baseURL` is centralized in `config/environment.ts`, no hardcoded `localhost:3000`.
- **Isolated test data per run** — each `test()` is a fresh `page` fixture and uses self-contained valid card / email constants from the known-facts block; no shared state, no order dependence, parallel-safe.
- **Trace + video on failure** — `trace: 'retain-on-failure'`, `video: 'retain-on-failure'`. First failure is enough to diagnose.
- **Health-checked app boot** — [scripts/start-app.ts](scripts/start-app.ts) polls `/api/health` before tests start, so we never race against a half-booted backend.
- **Generated code's success assertion is text-based**, not DOM-structure based: `getByText(/payment processed successfully/i)` survives benign markup changes around the success banner.

---

## Environment variables

| Variable | Purpose | Where set |
|---|---|---|
| `GEMINI_API_KEY` | Gemini auth | `.env` locally; GitHub repo secret in CI |
| `GEMINI_MODEL` | Override model name (default `gemini-2.5-flash-lite`) | `.env` / CI env |
| `GEMINI_MAX_ATTEMPTS` | Max attempts per Gemini call before giving up (default 5) | `.env` / CI env |
| `GEMINI_BACKOFF_BASE_MS` | Base delay for exponential-backoff retries (default 1000) | `.env` / CI env |
| `GENERATOR_CONCURRENCY` | Parallel API endpoint generations (default 4) | `.env` / CI env |
| `GENERATOR_MAX_RETRIES` | Max validator-repair retries per spec (default 2) | `.env` / CI env |
| `TEST_ENV` | Selects URL set in [config/environment.ts](config/environment.ts) | `.env` / CI env |
| `STAGING_API_URL` / `STAGING_BASE_URL` | API + frontend base URLs | `.env` / CI env |
| `APP_CODE_DIR` | Path to the app-under-test checkout (CI sets this to the sibling checkout) | `.env` / CI env |
| `SWAGGER_PATH` | Optional explicit override for the Swagger file | `.env` / CI env |
