import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { S3ModuleOptions } from 'nestjs-s3';
import { decode, encode } from 'universal-base64url';

dotenv.config();

export enum EnvType {
  PROD,
  DEV,
  DEBUG,
}

export class ConfigService {
  constructor(private env: NodeJS.ProcessEnv) {}

  private getValue(key: string, throwOnMissing = true): string {
    const value = this.env[key];
    if (typeof value !== 'string' && throwOnMissing) {
      throw new Error(`config error - missing process.env.${key}`);
    }
    return value;
  }

  public ensureValues(keys: string[]) {
    keys.forEach((k) => this.getValue(k, true));
    return this;
  }

  public getPort(): number {
    return +this.getValue('PORT', false) || 80;
  }

  public getListenHost() {
    return this.getValue('LISTEN_HOST', false) || '127.0.0.1';
  }

  public appEnv(): EnvType {
    const env = this.getValue('APP_ENV', false);
    switch (env) {
      case 'prod':
        return EnvType.PROD;
      case 'dev':
        return EnvType.DEV;
      case 'debug':
        return EnvType.DEBUG;
      default:
        throw new Error(`Unknown app env: ${env}`);
    }
  }

  public getTypeOrmConfig(): TypeOrmModuleOptions {
    return {
      type: 'postgres',

      host: this.getValue('POSTGRES_HOST'),
      port: +this.getValue('POSTGRES_PORT'),
      username: this.getValue('POSTGRES_USER'),
      password: this.getValue('POSTGRES_PASSWORD'),
      database: this.getValue('POSTGRES_DATABASE'),
      synchronize: this.appEnv() !== EnvType.PROD,
      migrationsTableName: 'migration',
      cache: {
        duration: 30000,
      },

      entities: ['dist/**/*.entity.js'],
      migrations: ['dist/migrations/*.js'],
      cli: {
        migrationsDir: 'dist/migrations',
      },
      logging: this.appEnv() == EnvType.PROD ? false : 'all',
    };
  }

  public getS3Config(): S3ModuleOptions {
    return {
      config: {
        accessKeyId: this.getValue('S3_ACCESS_KEY'),
        secretAccessKey: this.getValue('S3_SECRET_KEY'),
        endpoint: this.getS3Endpoint(),
        s3ForcePathStyle: true,
        signatureVersion: 'v4',
      },
    };
  }

  public getS3Endpoint(): string {
    return this.getValue('S3_ENDPOINT', true);
  }

  public getBuildsBucket(): string {
    return this.getValue('S3_BUILDS_BUCKET', true);
  }

  public getGitHubAuth() {
    return encode(this.getValue('GITHUB_AUTH', true));
  }
}

const configService = new ConfigService(process.env).ensureValues([
  'APP_ENV',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DATABASE',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_ENDPOINT',
  'S3_BUILDS_BUCKET',
  'GITHUB_AUTH',
]);

const APP_CONFIG = 'APP_CONFIG';

const configProvider = {
  provide: APP_CONFIG,
  useValue: configService,
};

export { configProvider, configService, APP_CONFIG };
