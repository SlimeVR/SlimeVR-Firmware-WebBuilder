FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install --global corepack@latest
RUN corepack enable pnpm
RUN apt-get update \
	&& apt-get install -y build-essential libssl-dev libffi-dev python3 python3-pip python3-venv git curl ca-certificates curl gnupg

RUN python3 --version
RUN curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py -o get-platformio.py
RUN python3 get-platformio.py
ENV PATH="${PATH}:/root/.platformio/penv/bin"
COPY . /app
WORKDIR /app

# FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# CMD pnpm run start:dev

FROM base
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
EXPOSE 3000
CMD node /app/dist/src/main.js