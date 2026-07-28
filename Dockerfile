FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
# Manifests first, so the install layer is only rebuilt when they change.
# pnpm-workspace.yaml carries the allowBuilds entries esbuild needs.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY ./ ./
RUN pnpm run build

FROM nginx:1.27-alpine
EXPOSE 8080
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/fun-n-talk/browser /usr/share/nginx/html
