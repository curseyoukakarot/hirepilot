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

# Install dependencies (production only, no audit/fund)
RUN npm ci --omit=dev --omit=optional --no-audit --no-fund

# Copy source code
COPY . .

# Build TypeScript (ultra-fast mode)
RUN npm run build:ultra-fast

# Remove source files to save space
RUN rm -rf src/ scripts/ *.ts tsconfig.json .tsbuildinfo

EXPOSE 8080

CMD ["npm", "start"] 