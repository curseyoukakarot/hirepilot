FROM node:20-bookworm-slim

WORKDIR /app

# OS deps Playwright/Chromium needs
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libexpat1 \
  libgbm1 \
  libglib2.0-0 \
  libgobject-2.0-0 \
  libgio-2.0-0 \
  libnspr4 \
  libnss3 \
  libnssutil3 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  libxshmfence1 \
  libatspi2.0-0 \
  && rm -rf /var/lib/apt/lists/*

# Install deps first (better caching)
COPY package*.json ./
RUN npm ci

# Install the browser binary
RUN npx playwright install chromium

# Copy app
COPY . .

# If your backend is TypeScript and needs build:
# RUN npm run build

ENV NODE_ENV=production
EXPOSE 8080

# Adjust if your start script differs
CMD ["npm","run","start"]
FROM node:20-slim

WORKDIR /app

# Copy manifests first (max cache hit)
COPY package*.json ./

# Install prod deps + ts-node
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev || npm install --omit=dev; \
    else \
      npm install --omit=dev; \
    fi && \
    npm install ts-node typescript --no-save

# Copy source
COPY . .

# Optional Playwright (disabled)
ARG ENABLE_PLAYWRIGHT=false
RUN if [ "$ENABLE_PLAYWRIGHT" = "true" ]; then \
      apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
        libcairo2 libcups2 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 \
        libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
        libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
        libxrandr2 libxrender1 libxss1 libxtst6 wget && \
      rm -rf /var/lib/apt/lists/* && \
      npx playwright install chromium; \
    fi

EXPOSE 8080
CMD ["node", "-r", "ts-node/register", "server.ts"]

