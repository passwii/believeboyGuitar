FROM nginx:1.29-alpine

LABEL org.opencontainers.image.title="believeboy guitar"
LABEL org.opencontainers.image.description="Static guitar practice site"

RUN rm -rf /usr/share/nginx/html/*
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
