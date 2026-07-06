FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate

COPY . .

EXPOSE 4000
# Migrations + production bootstrap run on every boot, not just under docker-compose —
# this is the one command every deploy platform (Render, a bare `docker run`,
# docker-compose) actually executes, so the schema and the first Super Admin account
# can never depend on someone having shell access to run a one-off command (Render's
# free tier has none). Both steps are idempotent: `prisma migrate deploy` skips
# already-applied migrations, and seed.production.js only creates the Super Admin if
# SUPERADMIN_EMAIL/PASSWORD are set and no account with that email exists yet.
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.production.js && node src/server.js"]
