FROM node:alpine

RUN \
  apk add --no-cache \
    bash \
    ca-certificates \
    postgresql-client

COPY package.json package-lock.json /app/

RUN \
  apk add --no-cache --virtual build-dependencies \
    build-base \
    git \
    linux-headers \
    musl-dev \
    postgresql-dev \
    python && \
  cd /app && \
  npm install && \
  apk del build-dependencies

RUN update-ca-certificates

COPY . /app/

WORKDIR /app/
