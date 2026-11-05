# เว็บ production แบบ Next.js standalone (design D3) — เป้า image < 200 MB
#   docker build --build-arg NEXT_PUBLIC_SDES_WS_URL=https://<โดเมน> -t sdes-web .
# NEXT_PUBLIC_* ถูกฝังตอน build (ทั้งในโค้ดฝั่ง browser และ CSP connect-src) จึงต้องเป็นโดเมนจริงของเครื่องนั้น
ARG NODE_IMAGE=node:22.23.4-alpine3.23
ARG ALPINE_IMAGE=alpine:3.23.7

FROM ${NODE_IMAGE} AS build
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate
WORKDIR /web
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_SDES_WS_URL
# rewrite /auth และ /api ของ Next ใช้เฉพาะเมื่อไม่มี reverse proxy — production ให้ Caddy ส่งไป api เอง (design D2)
ARG SDES_API_ORIGIN=http://api:3000
ENV NEXT_PUBLIC_SDES_WS_URL=${NEXT_PUBLIC_SDES_WS_URL} SDES_API_ORIGIN=${SDES_API_ORIGIN} NEXT_TELEMETRY_DISABLED=1
RUN test -n "$NEXT_PUBLIC_SDES_WS_URL" || (echo "ต้องระบุ --build-arg NEXT_PUBLIC_SDES_WS_URL=https://<โดเมน>" >&2 && exit 1)
RUN pnpm build
# trace ของ Next ดึง sharp (image optimizer — ปิดไว้ใน next.config) และ typescript (อ่าน next.config.ts ตอน build) มาด้วย
# server.js ใช้ค่าตั้งที่ compile แล้วใน required-server-files.json จึงไม่ต้องใช้ทั้งสองตัว
RUN cd .next/standalone/node_modules \
 && rm -rf .pnpm/sharp@* .pnpm/@img+* .pnpm/typescript@* typescript \
 && find /web/.next/standalone -name '*.map' -type f -delete

# runtime: alpine + binary ของ node อย่างเดียว (ไม่มี npm/yarn/corepack)
FROM ${NODE_IMAGE} AS node
FROM ${ALPINE_IMAGE} AS runtime
RUN apk add --no-cache libstdc++ libgcc && addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node
COPY --from=node /usr/local/bin/node /usr/local/bin/node
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /web/.next/standalone ./
COPY --from=build --chown=node:node /web/.next/static ./.next/static
COPY --from=build --chown=node:node /web/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]
