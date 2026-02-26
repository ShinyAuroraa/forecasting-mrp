import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { PrismaExceptionFilter } from './filters/prisma-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';

@Global()
@Module({
  providers: [
    // Order matters: PrismaExceptionFilter runs first, then HttpExceptionFilter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class CommonModule {}
