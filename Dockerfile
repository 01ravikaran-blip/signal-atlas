# Production Dockerfile for Signal Atlas 24/7 Autonomous System
FROM node:20-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install ALL dependencies (including tsx for runtime)
RUN npm install && cd server && npm install && cd ../client && npm install

# Copy full source
COPY . .

ENV NODE_ENV=production
ENV PORT=5050

EXPOSE 5050

# Use tsx to run TypeScript directly (same as local dev)
CMD ["node", "scripts/start.js"]
