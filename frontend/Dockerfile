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

FROM base AS build
ARG NEXT_PUBLIC_APP_NAME="Library Cloud"
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
