FROM node:latest
RUN echo "version:0.0.2"
WORKDIR /usr/prefetcher
COPY ./*.json ./
RUN npm install
RUN npm i -g @nestjs/cli
