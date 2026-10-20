# Build from the repository root (it needs ../shared):  docker build -f api/Dockerfile .
# ---- build: bundle the server (and the shared rules) into dist/index.js ----
FROM node:22-slim AS build
WORKDIR /app
COPY shared ./shared
COPY api/package.json api/package-lock.json ./api/
RUN cd api && npm ci --no-audit --no-fund
COPY api ./api
RUN cd api && npm run build

# ---- web: the app's web version, served by the same server ----
FROM node:22-slim AS web
WORKDIR /app
COPY shared ./shared
COPY mobile/package.json mobile/package-lock.json ./mobile/
RUN cd mobile && npm ci --no-audit --no-fund
COPY mobile ./mobile
RUN cd mobile && npx expo export --platform web --output-dir /web

# ---- run: Node, production packages, the bundle and the migrations ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4000 UPLOAD_DIR=/data/uploads
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/api/dist ./dist
COPY api/migrations ./migrations
COPY --from=web /web ./web
# Photos live here. On Railway, attach a volume at /data so they survive redeploys.
RUN mkdir -p /data/uploads
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
