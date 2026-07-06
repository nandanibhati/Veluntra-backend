FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate

COPY . .

EXPOSE 4000
# Migrations run on every boot, not just under docker-compose — this is the one command
# every deploy platform (Render, a bare `docker run`, docker-compose) actually executes,
# so the database schema can never be out of sync with the image running against it.
# `prisma migrate deploy` is idempotent: already-applied migrations are skipped.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
