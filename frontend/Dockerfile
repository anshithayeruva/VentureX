# VentureX web app (Next.js). Build from the frontend/ folder:
#   docker build --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api -t venturex-web frontend
# NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET are runtime secrets: set them on the host.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked into the browser bundle at build time; must end in /api.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
# The build checks that auth settings exist; these placeholders exist only in this build stage
# (server-only values are read at runtime, never inlined). Real values are set on the host.
ARG NEON_AUTH_BASE_URL=https://auth.build-placeholder.invalid
ARG NEON_AUTH_COOKIE_SECRET=build-stage-placeholder-not-a-secret-000000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEON_AUTH_BASE_URL=$NEON_AUTH_BASE_URL \
    NEON_AUTH_COOKIE_SECRET=$NEON_AUTH_COOKIE_SECRET \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/next.config.ts ./
USER node

EXPOSE 3000
CMD ["npm", "run", "start"]
