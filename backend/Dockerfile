FROM node:18-alpine

# Install Chromium (faster than Puppeteer download)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies first (needed for TypeScript build)
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build TypeScript (now tsc is available)
RUN npm run build:ultra-fast

# Clean up dev dependencies and source files to save space
RUN npm prune --omit=dev && \
    rm -rf src/ scripts/ *.ts tsconfig.json .tsbuildinfo node_modules/.cache

EXPOSE 8080

CMD ["npm", "start"] 