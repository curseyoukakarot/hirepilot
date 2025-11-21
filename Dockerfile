# Use AWS Public ECR mirror for Docker Official Images to avoid Docker Hub rate/auth issues
FROM public.ecr.aws/docker/library/node:20-bookworm-slim

# Build-time flags (tune image weight and logs)
ARG ENABLE_PLAYWRIGHT=false
ARG ENABLE_DEBUG_STEPS=false

# Install Playwright system dependencies (equivalent to --with-deps)
RUN if [ "$ENABLE_PLAYWRIGHT" = "true" ]; then \
      set -eux; \
      apt-get update; \
      apt-get install -y --no-install-recommends \
        ca-certificates \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        wget \
        xdg-utils; \
      rm -rf /var/lib/apt/lists/*; \
    fi

# Set working directory
WORKDIR /app

# Copy sources early (context filtered by .dockerignore)
COPY . .

# Install dependencies (use ci when lockfile exists)
RUN if [ -f "backend/package-lock.json" ]; then npm ci --omit=dev --prefix backend; else npm install --omit=dev --prefix backend; fi && \
    npm install --production ts-node typescript

# Install Chromium browser explicitly during build (optional)
RUN if [ "$ENABLE_PLAYWRIGHT" = "true" ]; then npx playwright install chromium; fi

# Copy sources (limited by .dockerignore to backend + minimal files)
COPY . .

# Build the TypeScript application
RUN npm run build:production --prefix backend

# Optional debug
RUN if [ "$ENABLE_DEBUG_STEPS" = "true" ]; then \
      echo \"=== POST-BUILD: Directory structure ===\" && pwd && ls -la && \
      echo \"=== POST-BUILD: Dist directory (backend) ===\" && ls -la backend/dist/ || true; \
    fi

# Expose app port (server binds to $PORT or 8080)
EXPOSE 8080

# Start command (we're already in /app/backend)
CMD ["/bin/sh", "-lc", "if [ -f backend/dist/server.js ]; then node backend/dist/server.js; elif [ -f dist/server.js ]; then node dist/server.js; elif [ -f backend/package.json ]; then npm start --prefix backend; else npm start; fi"]