import { Test } from '@nestjs/testing';
import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';
import type { DashboardKpis, RevenueChartData, ParetoData, StockCoverageData } from '../dashboard.types';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: Record<string, jest.Mock>;

  const mockKpis: DashboardKpis = {
    monthlyRevenue: { label: 'Receita Mensal', value: 100000, unit: 'BRL', variation: { value: 10000, percent: 11, direction: 'up' } },
    forecastAccuracy: { label: 'Acurácia Forecast', value: 85, unit: '%', variation: { value: 0, percent: 0, direction: 'stable' } },
    inventoryTurnover: { label: 'Giro de Estoque', value: 4.5, unit: 'x', variation: { value: 0, percent: 0, direction: 'stable' } },
    fillRate: { label: 'Fill Rate (OTIF)', value: 92, unit: '%', variation: { value: 0, percent: 0, direction: 'stable' } },
    referenceDate: '2026-02-26T00:00:00.000Z',
  };

  const mockRevenue: RevenueChartData = { points: [], divergenceFlags: [] };
  const mockPareto: ParetoData = { items: [], totalRevenue: 0 };
  const mockCoverage: StockCoverageData = { items: [] };

  beforeEach(async () => {
    service = {
      getKpis: jest.fn().mockResolvedValue(mockKpis),
      getRevenueChart: jest.fn().mockResolvedValue(mockRevenue),
      getPareto: jest.fn().mockResolvedValue(mockPareto),
      getStockCoverage: jest.fn().mockResolvedValue(mockCoverage),
    };

    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    }).compile();

    controller = module.get(DashboardController);
  });

  it('GET /dashboard/kpis should return KPI data', async () => {
    const result = await controller.getKpis();
    expect(result).toEqual(mockKpis);
    expect(service.getKpis).toHaveBeenCalledTimes(1);
  });

  it('GET /dashboard/revenue-chart should return chart data', async () => {
    const result = await controller.getRevenueChart();
    expect(result).toEqual(mockRevenue);
    expect(service.getRevenueChart).toHaveBeenCalledTimes(1);
  });

  it('GET /dashboard/pareto should return pareto data', async () => {
    const result = await controller.getPareto();
    expect(result).toEqual(mockPareto);
    expect(service.getPareto).toHaveBeenCalledTimes(1);
  });

  it('GET /dashboard/stock-coverage should return coverage data', async () => {
    const result = await controller.getStockCoverage();
    expect(result).toEqual(mockCoverage);
    expect(service.getStockCoverage).toHaveBeenCalledTimes(1);
  });
});
