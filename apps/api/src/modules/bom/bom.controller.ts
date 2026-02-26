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
} from '@nestjs/common';
import { BomService } from './bom.service';
import { BomVersionService } from './bom-version.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';
import { FilterBomDto } from './dto/filter-bom.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../common/pipes/uuid-validation.pipe';

@Controller('bom')
export class BomController {
  constructor(
    private readonly bomService: BomService,
    private readonly bomVersionService: BomVersionService,
  ) {}

  @Post()
  @Roles('operator')
  create(@Body() dto: CreateBomDto) {
    return this.bomService.create(dto);
  }

  @Get()
  @Roles('viewer')
  findAll(@Query() filters: FilterBomDto) {
    return this.bomService.findAll(filters);
  }

  @Get('tree/:produtoId')
  @Roles('viewer')
  getTree(@Param('produtoId', UuidValidationPipe) produtoId: string) {
    return this.bomService.buildTree(produtoId);
  }

  @Get('cost/:produtoId')
  @Roles('viewer')
  getExplodedCost(@Param('produtoId', UuidValidationPipe) produtoId: string) {
    return this.bomService.calculateExplodedCost(produtoId);
  }

  // --- BOM Versioning Endpoints (AC-8, AC-9, AC-10) ---
  // Must be defined before :id to avoid route conflict

  @Post('versions/:produtoPaiId')
  @Roles('operator')
  createVersion(
    @Param('produtoPaiId', UuidValidationPipe) produtoPaiId: string,
    @Body() body: { validoDesde?: string },
  ) {
    const validoDesde = body.validoDesde
      ? new Date(body.validoDesde)
      : new Date();
    return this.bomVersionService.createNewVersion(produtoPaiId, validoDesde);
  }

  @Get('versions/:produtoPaiId')
  @Roles('viewer')
  getVersionHistory(
    @Param('produtoPaiId', UuidValidationPipe) produtoPaiId: string,
  ) {
    return this.bomVersionService.getVersionHistory(produtoPaiId);
  }

  @Get('versions/:produtoPaiId/at/:date')
  @Roles('viewer')
  getVersionAt(
    @Param('produtoPaiId', UuidValidationPipe) produtoPaiId: string,
    @Param('date') date: string,
  ) {
    return this.bomVersionService.getVersionAt(produtoPaiId, new Date(date));
  }

  @Get('versions/:produtoPaiId/current')
  @Roles('viewer')
  getCurrentVersion(
    @Param('produtoPaiId', UuidValidationPipe) produtoPaiId: string,
  ) {
    return this.bomVersionService.getCurrentVersion(produtoPaiId);
  }

  // --- Standard CRUD by ID ---

  @Get(':id')
  @Roles('viewer')
  findOne(@Param('id', UuidValidationPipe) id: string) {
    return this.bomService.findById(id);
  }

  @Patch(':id')
  @Roles('operator')
  update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateBomDto,
  ) {
    return this.bomService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidValidationPipe) id: string) {
    return this.bomService.remove(id);
  }
}
