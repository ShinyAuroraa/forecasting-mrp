import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ScenarioService } from '../scenario.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SCENARIO_KEY_PREFIX } from '../scenario.types';

describe('ScenarioService', () => {
  let service: ScenarioService;
  let prisma: Record<string, any>;

  const mockScenario = {
    id: 'test-uuid',
    name: 'Test Scenario',
    description: 'Test desc',
    adjustments: {
      globalMultiplier: 1.2,
      classMultipliers: { A: 1.3, B: 1.0, C: 0.8 },
      skuOverrides: [],
    },
    createdAt: '2026-02-27T00:00:00.000Z',
    createdBy: null,
  };

  beforeEach(async () => {
    prisma = {
      configSistema: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      ordemPlanejada: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { custoEstimado: null } }),
      },
      eventoCapacidade: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      forecastResultado: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ total: null }]),
    };

    const module = await Test.createTestingModule({
      providers: [
        ScenarioService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ScenarioService);
  });

  // ── CRUD ──────────────────────────────────────

  describe('listScenarios', () => {
    it('should return empty array when no scenarios', async () => {
      const result = await service.listScenarios();
      expect(result).toEqual([]);
    });

    it('should return stored scenarios', async () => {
      prisma.configSistema.findMany.mockResolvedValue([
        { chave: `${SCENARIO_KEY_PREFIX}1`, valor: mockScenario },
      ]);

      const result = await service.listScenarios();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Test Scenario');
    });
  });

  describe('createScenario', () => {
    it('should create a scenario and return it', async () => {
      const result = await service.createScenario({
        name: 'New Scenario',
        adjustments: {
          globalMultiplier: 1.5,
          classMultipliers: { A: 1.5, B: 1.0, C: 1.0 },
        },
      });

      expect(result.name).toBe('New Scenario');
      expect(result.id).toBeDefined();
      expect(result.adjustments.globalMultiplier).toBe(1.5);
      expect(prisma.configSistema.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getScenario', () => {
    it('should return scenario by id', async () => {
      prisma.configSistema.findUnique.mockResolvedValue({
        chave: `${SCENARIO_KEY_PREFIX}test-id`,
        valor: mockScenario,
      });

      const result = await service.getScenario('test-id');
      expect(result.name).toBe('Test Scenario');
    });

    it('should throw NotFoundException for missing scenario', async () => {
      await expect(service.getScenario('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteScenario', () => {
    it('should delete existing scenario', async () => {
      prisma.configSistema.delete.mockResolvedValue({});

      await service.deleteScenario('test-id');
      expect(prisma.configSistema.delete).toHaveBeenCalledWith({
        where: { chave: `${SCENARIO_KEY_PREFIX}test-id` },
      });
    });

    it('should throw NotFoundException for missing scenario', async () => {
      prisma.configSistema.delete.mockRejectedValue({ code: 'P2025' });

      await expect(service.deleteScenario('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Impact Analysis ───────────────────────────

  describe('computeImpact', () => {
    beforeEach(() => {
      // Setup scenario retrieval
      prisma.configSistema.findUnique.mockResolvedValue({
        chave: `${SCENARIO_KEY_PREFIX}test-id`,
        valor: mockScenario,
      });
    });

    it('should compute impact with baseline metrics', async () => {
      prisma.ordemPlanejada.count
        .mockResolvedValueOnce(50)   // purchase
        .mockResolvedValueOnce(30);  // production
      prisma.ordemPlanejada.aggregate.mockResolvedValue({ _sum: { custoEstimado: 500000 } });
      prisma.$queryRaw.mockResolvedValue([{ total: 200000 }]);

      const result = await service.computeImpact('test-id');

      expect(result.scenarioId).toBe('test-id');
      expect(result.baseline.totalPlannedOrders).toBe(80);
      expect(result.scenario.totalPlannedOrders).toBe(96); // 80 * 1.2
      expect(result.delta.plannedOrdersDelta).toBe(16);
    });

    it('should scale order value by global multiplier', async () => {
      prisma.ordemPlanejada.count.mockResolvedValue(0);
      prisma.ordemPlanejada.aggregate.mockResolvedValue({ _sum: { custoEstimado: 100000 } });

      const result = await service.computeImpact('test-id');

      expect(result.scenario.totalOrderValue).toBe(120000); // 100000 * 1.2
      expect(result.delta.orderValueDelta).toBe(20000);
    });

    it('should apply capacity cap at 100%', async () => {
      prisma.ordemPlanejada.count.mockResolvedValue(0);
      prisma.ordemPlanejada.aggregate.mockResolvedValue({ _sum: { custoEstimado: 0 } });
      prisma.eventoCapacidade.findMany.mockResolvedValue([
        { valorNovo: '90' },
      ]);

      const result = await service.computeImpact('test-id');

      // 90 * 1.2 = 108 → capped at 100
      expect(result.scenario.avgCapacityUtilization).toBe(100);
    });

    it('should return forecast comparison points', async () => {
      prisma.ordemPlanejada.count.mockResolvedValue(0);
      prisma.ordemPlanejada.aggregate.mockResolvedValue({ _sum: { custoEstimado: 0 } });

      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);
      prisma.forecastResultado.findMany.mockResolvedValue([
        { periodo: futureDate, faturamentoP50: 100000, p50: null },
      ]);

      const result = await service.computeImpact('test-id');

      expect(result.forecastComparison.length).toBeGreaterThan(0);
      expect(result.forecastComparison[0].scenarioRevenue).toBe(120000); // 100000 * 1.2
    });
  });
});
