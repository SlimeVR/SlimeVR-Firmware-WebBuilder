import 'dotenv/config';
import { readFile } from 'fs/promises';

export const APP_ENV = process.env.APP_ENV ?? 'development';
export const PORT = process.env.PORT ?? 3000;
export const SUPPORTED_VERSIONS = process.env.SUPPORTED_VERSIONS ?? '>=0.13.0';
export const SOURCES_JSON_PATH =
  process.env.SOURCES_JSON_PATH ?? './sources.json';
export const GITHUB_AUTH_KEY = process.env.GITHUB_AUTH_KEY ?? '';
export const DATABASE_URL = process.env.DATABASE_URL ?? '';
export const S3_BUCKET = process.env.S3_BUCKET ?? '';
export const S3_ENDPOINT = process.env.S3_ENDPOINT ?? '';
export const SENTRY_DSN = process.env.SENTRY_DSN ?? '';

export const getS3Config = async () => {
  // This is kinda a hack but there is cases when the keys are not here but asked during build phase
  // This should not be an issue tho bc it only so nestia can generate the openapi spec.
  const getKey = async (key: string) =>
    (await readFile(key).catch(() => '')).toString().trim() ?? '';

  return {
    region: 'us-east-1',
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId:
        process.env.S3_ACCESS_KEY ?? (await getKey('/run/secrets/access_key')),
      secretAccessKey:
        process.env.S3_SECRET_KEY ?? (await getKey('/run/secrets/secret_key')),
    },
    forcePathStyle: true,
  };
};
