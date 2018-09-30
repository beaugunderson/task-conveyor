FROM node:alpine

RUN apk add --no-cache \
        bash \
        postgresql-client

RUN apk add --no-cache --virtual build-dependencies \
        build-base \
        git \
        linux-headers \
        musl-dev \
        postgresql-dev \
        python

WORKDIR /app/

COPY package.json /app/

RUN npm install
RUN apk del build-dependencies

COPY . /app/
