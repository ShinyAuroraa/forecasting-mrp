import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { CalendarioService } from './calendario.service';
import { CreateCalendarioDto } from './dto/create-calendario.dto';
import { UpdateCalendarioDto } from './dto/update-calendario.dto';
import { FilterCalendarioDto } from './dto/filter-calendario.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';

@Controller('calendario')
export class CalendarioController {
  constructor(private readonly calendarioService: CalendarioService) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateCalendarioDto) {
    return this.calendarioService.create(dto);
  }

  @Post('bulk')
  @Roles('operator')
  bulkCreate(@Body() entries: CreateCalendarioDto[]) {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new BadRequestException(
        'O corpo da requisicao deve ser um array nao vazio de entradas de calendario',
      );
    }
    return this.calendarioService.bulkCreate(entries);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterCalendarioDto) {
    return this.calendarioService.findAll(filters);
  }

  @Get('working-days')
  @Roles('viewer')
  countWorkingDays(
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    if (!start || !end) {
      throw new BadRequestException(
        'Parametros start e end sao obrigatorios (formato YYYY-MM-DD)',
      );
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException(
        'Datas invalidas. Use o formato YYYY-MM-DD',
      );
    }

    return this.calendarioService
      .countWorkingDays(startDate, endDate)
      .then((count) => ({ workingDays: count, start, end }));
  }

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.calendarioService.findById(id);
  }

  @Patch(':id')
  @Roles('operator')
  update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateCalendarioDto,
  ) {
    return this.calendarioService.update(id, dto);
  }

  @Delete(':id')
  @Roles('operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidValidationPipe) id: string) {
    return this.calendarioService.remove(id);
  }
}
