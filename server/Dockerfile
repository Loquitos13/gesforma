# Contexto de build: a raiz do repositório (o servidor importa src/partilhado).
FROM node:22-alpine
WORKDIR /app
RUN addgroup -S gesforma && adduser -S gesforma -G gesforma
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --omit=dev
COPY server/src ./server/src
COPY server/tsconfig.json ./server/
COPY src/partilhado ./src/partilhado
# O código fica legível para o utilizador da API seja qual for o umask de quem fez o checkout (um ficheiro só do root
# impedia a API de arrancar: EACCES).
RUN chmod -R a+rX /app/server/src /app/server/tsconfig.json /app/src
# Pasta dos ficheiros carregados sem Google Drive (volume «ficheiros» no docker-compose.yml).
RUN mkdir -p /app/server/data/drive-files && chown -R gesforma:gesforma /app/server/data
WORKDIR /app/server
USER gesforma
ENV NODE_ENV=production
EXPOSE 43148
CMD ["npx", "tsx", "src/index.ts"]
