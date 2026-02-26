import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import type { DashboardKpis, RevenueChartData, ParetoData, StockCoverageData } from './dashboard.types';

/**
 * Dashboard Controller — Executive BI Dashboard endpoints.
 *
 * @see Story 4.8 — AC-16, AC-17, AC-18, AC-19
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/kpis — aggregated KPI data.
   * @see AC-16
   */
  @Get('kpis')
  @Roles('viewer')
  async getKpis(): Promise<DashboardKpis> {
    return this.dashboardService.getKpis();
  }

  /**
   * GET /dashboard/revenue-chart — 12mo actual + 3mo forecast with P10-P90.
   * @see AC-17
   */
  @Get('revenue-chart')
  @Roles('viewer')
  async getRevenueChart(): Promise<RevenueChartData> {
    return this.dashboardService.getRevenueChart();
  }

  /**
   * GET /dashboard/pareto — ABC revenue distribution.
   * @see AC-18
   */
  @Get('pareto')
  @Roles('viewer')
  async getPareto(): Promise<ParetoData> {
    return this.dashboardService.getPareto();
  }

  /**
   * GET /dashboard/stock-coverage — coverage days per SKU.
   * @see AC-19
   */
  @Get('stock-coverage')
  @Roles('viewer')
  async getStockCoverage(): Promise<StockCoverageData> {
    return this.dashboardService.getStockCoverage();
  }
}
