# ---------- client build ----------
FROM node:20-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- server build ----------
FROM node:20-bookworm-slim AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build
RUN npm prune --omit=dev

# ---------- runtime ----------
FROM node:20-bookworm-slim
ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/app/data/data.sqlite
WORKDIR /app/server
COPY --from=server-build /app/server/node_modules ./node_modules
COPY --from=server-build /app/server/package.json ./package.json
COPY --from=server-build /app/server/dist ./dist
COPY --from=client-build /app/client/dist ../client/dist

VOLUME ["/app/data"]
EXPOSE 4000
CMD ["node", "dist/index.js"]
