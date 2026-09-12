# ---- Stage 1: Build client ----
FROM node:18-alpine AS client-builder
WORKDIR /app/client
COPY client/package.json client/pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY client/ .
RUN pnpm run build

# ---- Stage 2: Server runtime ----
FROM node:18-alpine
WORKDIR /app

# Set timezone to Beijing
RUN apk add --no-cache tzdata && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo "Asia/Shanghai" > /etc/timezone && apk del tzdata

# Install pnpm
RUN npm install -g pnpm

# Copy server deps
COPY server/package.json server/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# Copy server source
COPY server/ .

# Copy built client to server/public (Vite outputs to dist/)
COPY --from=client-builder /app/client/dist ./public

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3001

CMD ["node", "app.js"]
