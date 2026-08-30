# SkillSwap API server
FROM node:20-alpine AS build
WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/prisma ./prisma
COPY server/tsconfig.json ./
COPY server/src ./src

# Prisma client generation needs the schema's env var available at generate
# time (it is read at runtime, a placeholder is fine for build).
RUN npx prisma generate && npx tsc

# --- Runtime stage ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Prisma engines generated in devDependencies' .prisma dir must be present at
# runtime; copy them from the build stage.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=build /app/dist ./dist
COPY server/prisma ./prisma

EXPOSE 4000
CMD ["node", "dist/index.js"]
