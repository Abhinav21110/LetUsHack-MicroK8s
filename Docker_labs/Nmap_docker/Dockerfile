# syntax=docker/dockerfile:1

# 1) Build the Vite app
FROM node:20-alpine AS builder
WORKDIR /app

# Only install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the project and build
COPY . .

# Build-time configuration for main app URL (optional)
ARG VITE_MAIN_WEB_URL
ENV VITE_MAIN_WEB_URL=$VITE_MAIN_WEB_URL

# Build with env baked in
RUN npm run build

# 2) Serve with nginx
FROM nginx:alpine AS runner

# Install Node.js for runtime flag generation (lightweight)
RUN apk add --no-cache nodejs

# Copy custom nginx config if present
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Clean default site and add our build output
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist/ /usr/share/nginx/html/

# Copy entrypoint script for runtime flag generation
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1/ || exit 1

# Use entrypoint to generate random flags on every container start
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
