FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
RUN pnpm fetch
COPY ./ ./
RUN pnpm run build

FROM nginx:1.27-alpine
EXPOSE 8080
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/fun-n-talk/browser /usr/share/nginx/html
