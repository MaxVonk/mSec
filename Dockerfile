# syntax=docker/dockerfile:1

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend Assets
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy source configuration and files
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY server ./server

# Build the client distribution (Vite)
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3310

# Install production dependencies and bake tsx into the runtime image
COPY package*.json ./
RUN npm install --omit=dev && npm install -g tsx

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend server code and sample files
COPY server ./server
COPY samples ./samples

# Create persistent storage directory
RUN mkdir -p /app/.msec_data

# Expose server port
EXPOSE 3310

# Declare persistent volume for incident store & connector configs
VOLUME ["/app/.msec_data"]

# Start production server directly without runtime package downloads
CMD ["tsx", "server/index.ts"]

