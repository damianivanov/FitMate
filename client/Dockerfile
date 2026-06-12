# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Vite inlines VITE_* variables at BUILD time. Railway passes service variables to the
# Docker build as build args, so declare the ones the app reads here.
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# ---- runtime stage ----
FROM nginx:1.27-alpine AS runtime
# Substitute ONLY ${PORT} into the nginx config so nginx's own $uri/$host vars survive.
ENV NGINX_ENVSUBST_FILTER=^PORT$
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# The nginx image entrypoint runs envsubst on the template and starts nginx.
