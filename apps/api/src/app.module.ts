import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProdutosModule } from './modules/produtos/produtos.module';
import { FornecedoresModule } from './modules/fornecedores/fornecedores.module';
import { BomModule } from './modules/bom/bom.module';
import { CentrosTrabalhoModule } from './modules/centros-trabalho/centros-trabalho.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { IngestaoModule } from './modules/ingestao/ingestao.module';
import { ClassificacaoModule } from './modules/classificacao/classificacao.module';
import { ForecastModule } from './modules/forecast/forecast.module';
import { MrpModule } from './modules/mrp/mrp.module';
import { AutomationModule } from './modules/automation/automation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ScenarioModule } from './modules/scenarios/scenario.module';
import { ExportModule } from './modules/export/export.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { ConfigSistemaModule } from './modules/config/config-sistema.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
        port: Number(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port) || 6379,
      },
    }),
    PrismaModule,
    CommonModule,
    HealthModule,
    AuthModule,
    ProdutosModule,
    FornecedoresModule,
    BomModule,
    CentrosTrabalhoModule,
    InventarioModule,
    IngestaoModule,
    ClassificacaoModule,
    ForecastModule,
    MrpModule,
    AutomationModule,
    NotificationsModule,
    DashboardModule,
    ScenarioModule,
    ExportModule,
    ActivityLogModule,
    ConfigSistemaModule,
  ],
})
export class AppModule {}
