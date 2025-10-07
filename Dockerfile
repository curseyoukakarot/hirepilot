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
RUN echo "=== DEBUG: Looking for backend directory ===" && ls -la backend/ || echo "Backend directory not found"

# If backend exists, move into it; otherwise use current directory
RUN if [ -d "backend" ]; then \
      echo "Backend directory found, moving files..." && \
      cp -r backend/* . && \
      rm -rf backend frontend hirepilot-cookie public api services shared src supabase tools; \
    else \
      echo "No backend directory - assuming files are already in root"; \
    fi

RUN echo "=== DEBUG: Final file structure ===" && ls -la
RUN echo "=== DEBUG: Check for package.json ===" && ls -la package.json || echo "No package.json found"

# Install dependencies
RUN npm ci --production

# Install Chromium browser explicitly during build
RUN npx playwright install chromium

# Show files before build
RUN echo "=== PRE-BUILD: Files before TypeScript build ===" && ls -la
RUN echo "=== PRE-BUILD: Check for TypeScript files ===" && ls -la *.ts || echo "No TS files found"
RUN echo "=== PRE-BUILD: Check server.ts specifically ===" && ls -la server.ts || echo "No server.ts found"

# Build the TypeScript application
RUN npm run build:production

# Debug: Show what got built
RUN echo "=== POST-BUILD: Directory structure ===" && pwd && ls -la
RUN echo "=== POST-BUILD: Dist directory ===" && ls -la dist/ || echo "No dist directory found"
RUN echo "=== POST-BUILD: Looking for server files ===" && find . -name "*server*" -type f || echo "No server files found"

# Expose app port (server binds to $PORT or 8080)
EXPOSE 8080

# Start command (we're already in /app/backend)
CMD ["npm", "start"]