# Production Dockerfile for Signal Atlas 24/7 Autonomous System
FROM node:20-alpine

WORKDIR /app

# Copy package descriptors first for better Docker layer caching
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install ALL dependencies (including dev deps for build tools)
RUN npm install --ignore-scripts && \
    cd server && npm install --ignore-scripts && \
    cd ../client && npm install --ignore-scripts

# Copy full source
COPY . .

# Build the client frontend (Vite + React)
RUN cd client && npx vite build

ENV NODE_ENV=production
ENV PORT=5050

EXPOSE 5050

# Use tsx to run TypeScript directly (same as local dev)
CMD ["node", "scripts/start.js"]
