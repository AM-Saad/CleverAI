# syntax = docker/dockerfile:1


# Keep Railway aligned with package.json engines.node = "20.x"
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-slim AS base

LABEL railway_runtime="Nuxt/Prisma"

# Nuxt/Prisma app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"
ARG YARN_VERSION=1.22.22
RUN npm install -g yarn@$YARN_VERSION --force


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp openssl pkg-config python-is-python3

# Install node modules. postinstall runs Nuxt prepare and Prisma generate, so
# copy the minimum app/config/schema files it needs before yarn install.
COPY package.json yarn.lock ./
COPY nuxt.config.ts tsconfig.json ./
COPY app ./app
COPY public ./public
COPY scripts ./scripts
COPY server ./server
COPY shared ./shared
COPY sw-src ./sw-src
RUN yarn install --frozen-lockfile --production=false

# Generate Prisma Client
RUN npx prisma generate --schema=server/prisma/schema.prisma

# Copy application code
COPY . .

RUN echo "=== ICONS ===" && ls -la /app/app/assets/images/icons || echo "ICONS MISSING"
# Build application
RUN yarn run build


# Final stage for app image
FROM base

# Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copy built application
COPY --from=build /app/.output /app/.output

# Start the server by default, this can be overwritten at runtime
EXPOSE 8080
ENV HOST=0.0.0.0
CMD [ "node", ".output/server/index.mjs" ]
