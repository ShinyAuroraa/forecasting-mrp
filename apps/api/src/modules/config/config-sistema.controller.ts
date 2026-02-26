import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigSistemaService } from './config-sistema.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpsertConfigDto } from './dto/upsert-config.dto';

/**
 * AC-6: Configuration CRUD endpoints.
 * Read operations require viewer role; write operations require admin role.
 */
@Controller('config')
export class ConfigSistemaController {
  constructor(private readonly configService: ConfigSistemaService) {}

  @Get()
  @Roles('viewer')
  getAll() {
    return this.configService.getAll();
  }

  @Get(':chave')
  @Roles('viewer')
  get(@Param('chave') chave: string) {
    return this.configService.get(chave);
  }

  @Patch(':chave')
  @Roles('admin')
  upsert(
    @Param('chave') chave: string,
    @Body() body: UpsertConfigDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.configService.upsert(chave, body.valor, body.descricao, userId);
  }

  @Delete(':chave')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('chave') chave: string) {
    return this.configService.delete(chave);
  }

  @Post('seed')
  @Roles('admin')
  seedDefaults() {
    return this.configService.seedDefaults();
  }
}
