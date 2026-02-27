import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { MrpService } from './mrp.service';
import { ExecuteMrpDto } from './dto/execute-mrp.dto';
import { FilterExecutionsDto } from './dto/filter-executions.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { FilterCapacityDto } from './dto/filter-capacity.dto';
import { FilterStockParamsDto } from './dto/filter-stock-params.dto';
import { LotSizingCompareDto } from './dto/lot-sizing-compare.dto';
import { MonteCarloSimulationDto } from './dto/monte-carlo-simulation.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UuidValidationPipe } from '../../common/pipes/uuid-validation.pipe';

/**
 * MrpController — MRP Execution & Read API
 *
 * Exposes the MRP orchestrator as a REST API:
 *   - POST /mrp/execute — Trigger a full MRP run (AC-1, AC-13)
 *   - GET  /mrp/executions — List execution history
 *   - GET  /mrp/executions/:id — Get execution detail with step logs
 *   - GET  /mrp/orders — List planned orders
 *   - GET  /mrp/capacity — List capacity load records
 *   - GET  /mrp/stock-params — List stock parameter records
 *   - POST /mrp/stock-params/monte-carlo — Run Monte Carlo simulation for a product
 *
 * Role hierarchy: viewer < operator < manager < admin
 *
 * @see Story 3.10 — MRP Orchestrator & Execution API
 */
@Controller('mrp')
export class MrpController {
  constructor(private readonly mrpService: MrpService) {}

  /**
   * Trigger a full MRP execution run.
   *
   * Returns 202 Accepted with the execution ID and final status.
   * The execution runs synchronously within this request.
   *
   * @param dto - Optional execution parameters
   * @returns Execution result with ID, status, and message
   */
  @Post('execute')
  @Roles('manager')
  @HttpCode(HttpStatus.ACCEPTED)
  execute(@Body() dto: ExecuteMrpDto): Promise<any> {
    return this.mrpService.executeMrp(dto);
  }

  /**
   * List MRP executions with pagination and optional status filter.
   *
   * @param filters - Pagination and status filter
   * @returns Paginated execution records
   */
  @Get('executions')
  @Roles('viewer')
  findAllExecutions(@Query() filters: FilterExecutionsDto) {
    return this.mrpService.findAllExecutions(filters);
  }

  /**
   * Get a single MRP execution by ID with step logs.
   *
   * @param id - Execution UUID
   * @returns Execution with step logs
   */
  @Get('executions/:id')
  @Roles('viewer')
  findExecutionById(@Param('id', UuidValidationPipe) id: string) {
    return this.mrpService.findExecutionById(id);
  }

  /**
   * List planned orders with pagination and filters.
   *
   * @param filters - Pagination, execucaoId, tipo, prioridade, produtoId filters
   * @returns Paginated planned order records
   */
  @Get('orders')
  @Roles('viewer')
  findOrders(@Query() filters: FilterOrdersDto) {
    return this.mrpService.findOrders(filters);
  }

  /**
   * List capacity load records with pagination and filters.
   *
   * @param filters - Pagination, execucaoId, centroTrabalhoId filters
   * @returns Paginated capacity load records
   */
  @Get('capacity')
  @Roles('viewer')
  findCapacity(@Query() filters: FilterCapacityDto) {
    return this.mrpService.findCapacity(filters);
  }

  /**
   * List stock parameter records with pagination and filters.
   *
   * @param filters - Pagination, execucaoId, produtoId filters
   * @returns Paginated stock parameter records
   */
  @Get('stock-params')
  @Roles('viewer')
  findStockParams(@Query() filters: FilterStockParamsDto) {
    return this.mrpService.findStockParams(filters);
  }

  /**
   * Run Monte Carlo safety stock simulation for a specific product.
   *
   * Returns the calculated safety stock, confidence interval (p5, p95),
   * number of iterations, and histogram buckets for visualization.
   *
   * @param dto - Product UUID, optional serviceLevel and iterations
   * @returns Monte Carlo simulation result
   * @see Story 5.2 — FR-065, AC-11, AC-12
   */
  @Post('stock-params/monte-carlo')
  @Roles('operator')
  @HttpCode(HttpStatus.OK)
  runMonteCarloSimulation(@Body() dto: MonteCarloSimulationDto) {
    return this.mrpService.runMonteCarloSimulation(
      dto.produtoId,
      dto.serviceLevel,
      dto.iterations,
    );
  }

  /**
   * Compare all 4 lot sizing methods for a product.
   *
   * Returns cost breakdown (ordering + holding) for L4L, EOQ, Silver-Meal,
   * and Wagner-Whitin, plus a recommendation for the lowest-cost method.
   *
   * @param query - Product UUID
   * @returns Cost comparison and recommendation
   * @see Story 5.1 — FR-064
   */
  @Get('lot-sizing/compare')
  @Roles('viewer')
  compareLotSizing(@Query() query: LotSizingCompareDto) {
    return this.mrpService.compareLotSizing(query.produtoId);
  }
}
