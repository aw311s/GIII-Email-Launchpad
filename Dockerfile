FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build


FROM mcr.microsoft.com/playwright:v1.61.1-noble

ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

COPY server ./server
COPY --from=frontend-build /app/dist ./dist

EXPOSE 10000

CMD ["node", "server/server.js"]
