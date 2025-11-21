FROM node:20-slim

WORKDIR /app

# 1) Copy manifests first for optimal caching
COPY package*.json ./
COPY backend/package*.json ./backend/

# 2) Install only production deps for backend
RUN cd backend && \
    if [ -f "package-lock.json" ]; then \
      npm ci --omit=dev || npm install --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# 3) Copy source code
COPY backend ./backend
COPY shared ./shared

# 4) Build TypeScript (use a minimal docker-specific tsconfig)
# Ensure TypeScript is available for build without bloating runtime
RUN npm install --no-save typescript && \
    npx tsc -p backend/tsconfig.docker.json || true && \
    rm -rf node_modules

# Optional Playwright (disabled by default)
ARG ENABLE_PLAYWRIGHT=false
RUN if [ "$ENABLE_PLAYWRIGHT" = "true" ]; then \
      apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
        libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 \
        libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
        libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
        libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
        libxtst6 wget && \
      rm -rf /var/lib/apt/lists/* && \
      cd backend && npx playwright install chromium; \
    fi

EXPOSE 8080
CMD ["node", "backend/dist/server.js"]