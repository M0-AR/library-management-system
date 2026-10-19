FROM node:24-alpine AS base
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV NODE_OPTIONS=--dns-result-order=ipv4first
ENV npm_config_fetch_retries=5
ENV npm_config_fetch_retry_maxtimeout=120000
RUN npm config set registry "$NPM_REGISTRY" \
 && npm install -g pnpm@9.15.4 --no-fund --no-audit
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/main.js"]
