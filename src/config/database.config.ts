import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const dbType = configService.get<string>('database.type', 'sqlite');

  const baseConfig: Partial<TypeOrmModuleOptions> = {
    autoLoadEntities: true,
    synchronize: configService.get<string>('nodeEnv') !== 'production',
    logging: configService.get<string>('nodeEnv') === 'development',
  };

  if (dbType === 'sqlite') {
    return {
      ...baseConfig,
      type: 'sqlite',
      database: configService.get<string>('database.database', 'webhooks.db'),
    } as TypeOrmModuleOptions;
  }

  // PostgreSQL configuration
  return {
    ...baseConfig,
    type: 'postgres',
    host: configService.get<string>('database.host', 'localhost'),
    port: configService.get<number>('database.port', 5432),
    username: configService.get<string>('database.username', 'postgres'),
    password: configService.get<string>('database.password', ''),
    database: configService.get<string>('database.database', 'webhooks'),
  } as TypeOrmModuleOptions;
};
