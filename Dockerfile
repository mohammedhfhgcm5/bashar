FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
ENV DATABASE_URL=postgresql://damage:damage@127.0.0.1:5432/damage?schema=public
RUN npm run build -w @damage/shared \
  && npm run build -w @damage/api \
  && npm run build -w @damage/web

FROM postgis/postgis:16-3.4

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    nginx \
    python3 \
    python-is-python3 \
    ca-certificates \
    openssl \
    libgomp1 \
    libatomic1 \
    gettext-base \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build /app/package.json /app/package-lock.json /app/
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/shared /app/packages/shared
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/prisma /app/apps/api/prisma
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY ml/train.py ml/requirements.txt /app/ml/
COPY ml/weights/ /models/
COPY docker/nginx.single.conf.template /etc/nginx/templates/default.conf.template
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production \
    API_PORT=3000 \
    PORT=8080 \
    PGDATA=/data/postgres \
    UPLOAD_DIR=/data/uploads \
    VISION_MODEL_PATH=/models/peccd-yolov8n.onnx

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
