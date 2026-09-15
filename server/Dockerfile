FROM node:22-alpine
WORKDIR /app
RUN addgroup -S gesforma && adduser -S gesforma -G gesforma
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY src ./src
COPY tsconfig.json ./
USER gesforma
ENV NODE_ENV=production
EXPOSE 43148
CMD ["npx", "tsx", "src/index.ts"]
