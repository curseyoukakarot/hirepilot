FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy only the files needed for attribution worker
COPY workers/standalone/emailAttributionStandalone.ts ./workers/standalone/
COPY tsconfig.json ./

# Install TypeScript for ts-node
RUN npm install -g typescript ts-node

# Set environment variables
ENV NODE_ENV=production

# Run the standalone attribution worker
CMD ["npm", "run", "worker:attribution-standalone"]
