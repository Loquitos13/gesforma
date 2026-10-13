# Contexto de build: a raiz do repositório (o servidor importa src/partilhado).
FROM node:22-alpine
WORKDIR /app
RUN addgroup -S gesforma && adduser -S gesforma -G gesforma
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --omit=dev
COPY server/src ./server/src
COPY server/tsconfig.json ./server/
COPY src/partilhado ./src/partilhado
WORKDIR /app/server
USER gesforma
ENV NODE_ENV=production
EXPOSE 43148
CMD ["npx", "tsx", "src/index.ts"]
