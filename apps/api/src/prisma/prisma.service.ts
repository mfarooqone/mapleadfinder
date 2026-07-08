import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString:
          process.env.DATABASE_URL ??
          'postgresql://postgres:postgres@localhost:5432/postgres?schema=public',
      }),
    });
  }

  async onModuleInit() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.SKIP_DB_CONNECT === 'true'
    ) {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
