import { DataSource } from 'typeorm';

export const connectionSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: +process.env.POSTGRES_PORT,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  synchronize: process.env.APP_ENV != 'prod',
  migrationsTableName: 'migration',
  cache: {
    duration: 30000,
  },
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
  logging:
    process.env.APP_ENV == 'prod'
      ? ['schema', 'error', 'warn', 'info', 'log', 'migration']
      : 'all',
});
