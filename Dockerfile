# Dockerfile for the AI-driven test generation + Playwright runner.
# Pinned to the matching Playwright version so the bundled browsers match
# the @playwright/test in package.json. Use this image in CI to skip the
# "npx playwright install --with-deps" step.
FROM mcr.microsoft.com/playwright:v1.55.1-jammy

ENV NODE_ENV=development \
    PW_TEST_HTML_REPORT_OPEN=never \
    CI=true

WORKDIR /app

# Install Go (the app under test runs on Go 1.21) so a single image can
# also boot the backend when running the full local gate. CI typically
# starts the app in a sibling step instead.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git \
 && curl -fsSL https://go.dev/dl/go1.21.13.linux-amd64.tar.gz \
      | tar -C /usr/local -xz \
 && rm -rf /var/lib/apt/lists/*
ENV PATH="/usr/local/go/bin:${PATH}"

# Install Node deps first for layer caching.
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the framework.
COPY . .

# Default entrypoint: regenerate specs (cached) then run the suite.
# Override at run time, e.g. `docker run ... npm run gate`.
CMD ["npm", "run", "gate"]
