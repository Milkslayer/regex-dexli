# Multi-stage build: tiny final image, full devDeps only during build.
# Single-command build (`docker build .`) + single-command run (`docker run -p`).

# ---- Build stage ----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install all deps (including dev) for the build. npm ci against the
# committed package-lock keeps builds reproducible across machines.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy the rest and produce the adapter-node build output at /app/build.
COPY . .
RUN npm run build

# Drop dev dependencies so we copy only runtime deps into the final stage.
RUN npm prune --omit=dev

# ---- Runtime stage --------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# OCI image metadata. Source URL is a placeholder pending repo creation by
# M; fixable post-publish without a rebuild contract change.
LABEL org.opencontainers.image.title="regex" \
      org.opencontainers.image.description="Live regex tester with URL-shareable state — type a pattern, see matches highlight as you go. Part of the dexli.dev tiny-tools family." \
      org.opencontainers.image.source="https://github.com/dexli-dev/regex-dexli" \
      org.opencontainers.image.licenses="UNLICENSED"

# Fallback defaults only — every value is overridable at run time via -e.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# adapter-node ships a self-contained `build/` directory; we still need the
# pruned node_modules and package.json for module resolution at runtime.
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

EXPOSE 3000

# Run as the unprivileged `node` user that the official image already provides.
USER node

CMD ["node", "build"]
