# Use AWS Public ECR mirror for Docker Official Images to avoid Docker Hub rate/auth issues
FROM public.ecr.aws/docker/library/node:20-bookworm-slim

# Install Playwright system dependencies (equivalent to --with-deps)
RUN apt-get update && apt-get install -y \
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
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy everything to see what's available
COPY . .
RUN echo "=== DEBUG: All files in project root ===" && ls -la
RUN echo "=== DEBUG: Confirm backend directory ===" && ls -la backend/ && ls -la backend/server.ts
RUN echo "=== DEBUG: Show root tsconfig ===" && cat tsconfig.json
RUN echo "=== DEBUG: Show backend package.json ===" && cat backend/package.json

# Install dependencies
RUN npm ci --production --prefix backend

# Install Chromium browser explicitly during build
RUN npx playwright install chromium

# Show files before build
RUN echo "=== PRE-BUILD: Files before TypeScript build ===" && ls -la backend
RUN echo "=== PRE-BUILD: Check server.ts specifically ===" && ls -la backend/server.ts

# Build the TypeScript application
RUN npm run build:production --prefix backend

# Debug: Show what got built
RUN echo "=== POST-BUILD: Directory structure ===" && pwd && ls -la
RUN echo "=== POST-BUILD: Dist directory ===" && ls -la backend/dist/ || echo "No dist directory found"
RUN echo "=== POST-BUILD: Looking for server files ===" && find backend -name "server.js" -type f || echo "No server files found"

# Expose app port (server binds to $PORT or 8080)
EXPOSE 8080

# Start command (we're already in /app/backend)
CMD ["npm", "start", "--prefix", "backend"]