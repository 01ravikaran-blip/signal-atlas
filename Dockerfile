# Multi-stage Dockerfile for Signal Atlas 24/7 Autonomous System
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm run install:all

# Copy full source
COPY . .

# Build TypeScript server & React client
RUN cd server && npm run build

# Production runner image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5050

COPY package*.json ./
COPY server/package*.json ./server/
COPY scripts ./scripts

# Install production node_modules
RUN npm install --omit=dev && cd server && npm install --omit=dev

# Copy built server assets
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src ./server/src

EXPOSE 5050

CMD ["npm", "start"]
