# ============================================================================
# TalentMate 镜像构建
#
# 这台生产服务器只有 1.7GB 内存。在容器内跑客户端构建（pnpm install 数百个包 +
# Vite 打包）会把内存打满，导致 sshd/nginx 无法 fork、整机失联。
#
# 因此支持「客户端在本地构建」的模式：
#   本地  ： cd client && pnpm run build          # 生成 client/dist
#   服务器： docker compose build --build-arg PREBUILT_CLIENT=1
#
# 该模式完全不碰客户端依赖，只把 client/dist 拷进镜像，
# 构建耗时从几分钟降到几秒，内存峰值大幅下降。
#
# 默认为完整构建（在内存充足的机器上可直接 `docker compose up -d --build`）。
# 注意：这条命令依赖 client/dist 存在；若不存在会在构建时明确失败，
# 而不是产出一个没有前端页面的镜像。
# ============================================================================

# ---- Stage 1: Build client ----
FROM node:18-alpine AS client-builder
WORKDIR /app/client

# 固定 pnpm 版本，保证构建可复现。
# 不要用 `npm install -g pnpm`：那会装到当时最新版，其行为可能与仓库 lockfile /
# 本地开发环境不一致（例如 pnpm 10.34 会对被忽略的安装脚本直接报
# ERR_PNPM_IGNORED_BUILDS 而构建失败）。
RUN npm install -g pnpm@10.24.0

# 国内服务器直连 registry.npmjs.org 极慢（实测 3.24s vs npmmirror 0.09s），
# 会出现大量 "Operation timed out" 导致构建失败，因此统一走国内镜像。
RUN pnpm config set registry https://registry.npmmirror.com

COPY client/package.json client/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY client/ .
RUN pnpm run build

# ---- Stage 2: Server runtime ----
FROM node:18-alpine
WORKDIR /app

ARG PREBUILT_CLIENT=0

# Set timezone to Beijing
RUN apk add --no-cache tzdata && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo "Asia/Shanghai" > /etc/timezone && apk del tzdata

# Install pnpm（同样固定版本）
RUN npm install -g pnpm@10.24.0
RUN pnpm config set registry https://registry.npmmirror.com

# Copy server deps
COPY server/package.json server/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# Copy server source
COPY server/ .

# 前端静态资源：
#   默认 —— 使用上面 client-builder 的产物
#   PREBUILT_CLIENT=1 —— 使用本地已构建的 client/dist
COPY --from=client-builder /app/client/dist ./public
COPY client/dist/ /app/prebuilt/
RUN if [ "$PREBUILT_CLIENT" = "1" ]; then rm -rf ./public && mv /app/prebuilt ./public; fi \
    && rm -rf /app/prebuilt \
    && test -f ./public/index.html \
    && echo "client assets ready -> $(ls ./public | tr '\n' ' ')"

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3001

CMD ["node", "app.js"]
