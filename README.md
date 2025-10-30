## Description

Slimevr firmware build api allows to build a tracker firmware with any configuration of boards, IMUs, pins and many other stuff

## Installation
1. Copy the ``.env.template`` file to ``.env``
2. Edit the ``.env`` to your needs
3. Edit the ``docker-compose.dev.yml`` to your network needs
4. Generate access_key.txt and secret_key.txt for MinIO:
```bash
$ mkdir -p ./docker/minio

# Set the username for MinIO:
$ echo SLIMEVRACCESS > ./docker/minio/access_key.txt && chmod 600 ./docker/minio/access_key.txt

# Generate a random password for MinIO:
$ openssl rand -hex 16 > ./docker/minio/secret_key.txt && chmod 600 ./docker/minio/secret_key.txt
```
5. Run the app and apply the migrations for the database

## Running the app (DEV MODE)
We highly recommend that you use the dev docker-compose as the main one is setup for our production servers

```bash
$ docker compose -f docker-compose.dev.yml up -d

# First time only, you need to apply the migrations to the empty postgres database
$ docker compose -f docker-compose.dev.yml run --rm api npx drizzle-kit migrate
```

## Adding Different Firmwares
To add different firmware versions, edit the ``sources.json`` file. The Docker container checks this file every 5 minutes.