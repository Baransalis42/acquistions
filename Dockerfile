# syntax=docker/dockerfile:1

#############################################
# Base: shared OS-level setup
#############################################
FROM node:20-alpine AS base
WORKDIR /app
# Needed at runtime by some transitive native deps on musl libc
RUN apk add --no-cache libc6-compat


#############################################
# Dependencies: install with dev deps + build
# toolchain (bcrypt compiles a native addon)
#############################################
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci


#############################################
# Development: full deps, source mounted via
# docker-compose.dev.yml, hot reload with
# node --watch
#############################################
FROM deps AS development
ENV NODE_ENV=development
COPY . .
RUN mkdir -p logs
EXPOSE 3000
CMD ["npm", "run", "dev"]


#############################################
# Production dependencies only (no devDeps,
# but keep the build toolchain to compile bcrypt)
#############################################
FROM base AS prod-deps
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force


#############################################
# Production: minimal runtime image, non-root
#############################################
FROM base AS production
ENV NODE_ENV=production
RUN addgroup -S nodejs -g 1001 && adduser -S expressjs -u 1001 -G nodejs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --chown=expressjs:nodejs . .
RUN mkdir -p logs && chown -R expressjs:nodejs /app

USER expressjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
