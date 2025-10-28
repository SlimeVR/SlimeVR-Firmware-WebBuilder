## Description

Slimevr firmware build api allows to build a tracker firmware with any configuration of Board imus pins and many other stuff

## Installation

```bash
$ pnpm install
```

## Running the app (DEV MODE)

Make sure to copy the ``.env.template`` file to ``.env``
We highly recommend that you use the dev docker-compose as the main one is setup for our production servers

```bash
$ docker-compose -f docker-compose.dev.yml up -d

# First time only, you need to apply the migrations to the empty postgres database
$ docker compose -f docker-compose.dev.yml run --rm api pnpm drizzle-kit migrate
```
