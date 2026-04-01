# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDeps for build if needed)
RUN npm install

# Copy source code
COPY . .

# Future-proof: Build step (e.g., for TS or Bundling)
# RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy only production dependencies from builder
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Copy source code from builder
COPY --from=builder /app .

# Create logs directory and set permissions
RUN mkdir -p logs && chown node:node logs

# Use non-root user for security
USER node

EXPOSE 3000

CMD ["npm", "start"]
