import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { CrpService } from './crp.service';
import type { CrpInput } from './interfaces/crp.interface';

/**
 * Unit tests for CrpService — Capacity Requirements Planning Engine
 *
 * Test cases cover all CRP ACs from Story 3.9:
 *   1.  Normal load (<100%): no overload, sugestao = OK (AC-1, AC-4)
 *   2.  Overload 100-110%: sugestao = HORA_EXTRA (AC-5)
 *   3.  Overload 110-130%: sugestao = ANTECIPAR (AC-5)
 *   4.  Overload >130%: sugestao = SUBCONTRATAR (AC-5)
 *   5.  Scheduled stop reduces available capacity (AC-3)
 *   6.  Multiple shifts increase capacity (AC-3)
 *   7.  No production orders: load = 0 (AC-1)
 *   8.  Working days from CalendarioFabrica (AC-7)
 *   9.  Overnight shift calculation (AC-3)
 *   10. Zero available capacity (all holidays): no division by zero (AC-4)
 *   11. Persistence: createMany called with correct data (AC-6)
 *   12. Does not modify planned orders — read-only (AC-12)
 *
 * @see Story 3.9 — CRP & Storage Capacity Validation
 * @see FR-040 — Capacity Requirements Planning
 */
describe('CrpService', () => {
  let service: CrpService;

  // ────────────────────────────────────────────────────────────────
  // Mock Setup
  // ────────────────────────────────────────────────────────────────

  const mockPrismaService = {
    centroTrabalho: {
      findMany: jest.fn(),
    },
    ordemPlanejada: {
      findMany: jest.fn(),
    },
    roteiroProducao: {
      findMany: jest.fn(),
    },
    calendarioFabrica: {
      findMany: jest.fn(),
    },
    cargaCapacidade: {
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrpService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CrpService>(CrpService);

    // Default: createMany resolves successfully
    mockPrismaService.cargaCapacidade.createMany.mockResolvedValue({
      count: 0,
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────

  /** Create a mock Prisma Decimal */
  const mockDecimal = (value: number) => ({
    toNumber: () => value,
    toString: () => String(value),
    valueOf: () => value,
  });

  /** Monday 2026-03-02 UTC */
  const WEEK_START = new Date(Date.UTC(2026, 2, 2));
  /** Monday 2026-03-09 UTC */
  const WEEK_END = new Date(Date.UTC(2026, 2, 9));

  /** Create a standard weekly bucket for one week */
  const makeWeeklyBucket = (
    start: Date = WEEK_START,
    end: Date = WEEK_END,
  ) => ({
    periodStart: start,
    periodEnd: end,
  });

  /** Create a CRP input */
  const makeInput = (overrides?: Partial<CrpInput>): CrpInput => ({
    execucaoId: 'exec-001',
    weeklyBuckets: [makeWeeklyBucket()],
    ...overrides,
  });

  /** Create a Time value from hours and minutes (Prisma @db.Time) */
  const makeTime = (hours: number, minutes: number = 0): Date =>
    new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));

  /**
   * Setup work centers mock with a single work center.
   * Default: 1 shift (08:00-16:00, Mon-Fri), 100% efficiency, no stops.
   */
  const setupWorkCenter = (overrides?: {
    id?: string;
    codigo?: string;
    nome?: string;
    eficienciaPercentual?: ReturnType<typeof mockDecimal> | null;
    turnos?: {
      id?: string;
      horaInicio?: Date;
      horaFim?: Date;
      diasSemana?: number[];
      ativo?: boolean;
      validoDesde?: Date | null;
      validoAte?: Date | null;
    }[];
    paradasProgramadas?: {
      dataInicio: Date;
      dataFim: Date;
    }[];
  }) => {
    const defaultTurno = {
      id: 'turno-001',
      horaInicio: makeTime(8, 0), // 08:00
      horaFim: makeTime(16, 0), // 16:00
      diasSemana: [1, 2, 3, 4, 5], // Mon-Fri
      ativo: true,
      validoDesde: null,
      validoAte: null,
    };

    const wc = {
      id: overrides?.id ?? 'wc-001',
      codigo: overrides?.codigo ?? 'WC-001',
      nome: overrides?.nome ?? 'Centro 1',
      eficienciaPercentual:
        overrides?.eficienciaPercentual ?? mockDecimal(100),
      turnos: overrides?.turnos?.map((t, i) => ({
        id: t.id ?? `turno-${i + 1}`,
        horaInicio: t.horaInicio ?? makeTime(8, 0),
        horaFim: t.horaFim ?? makeTime(16, 0),
        diasSemana: t.diasSemana ?? [1, 2, 3, 4, 5],
        ativo: t.ativo ?? true,
        validoDesde: t.validoDesde ?? null,
        validoAte: t.validoAte ?? null,
      })) ?? [defaultTurno],
      paradasProgramadas: overrides?.paradasProgramadas ?? [],
    };

    mockPrismaService.centroTrabalho.findMany.mockResolvedValue([wc]);
    return wc;
  };

  /**
   * Setup calendar with working days (tipo=UTIL) for the test week.
   * Default: Mon-Fri are UTIL (5 working days).
   */
  const setupCalendar = (
    utilDates?: string[],
  ) => {
    const defaults = [
      '2026-03-02', // Mon
      '2026-03-03', // Tue
      '2026-03-04', // Wed
      '2026-03-05', // Thu
      '2026-03-06', // Fri
    ];
    const dates = utilDates ?? defaults;

    mockPrismaService.calendarioFabrica.findMany.mockResolvedValue(
      dates.map((d) => ({ data: new Date(d + 'T00:00:00.000Z') })),
    );
  };

  /**
   * Setup production orders for the test execution.
   */
  const setupProductionOrders = (
    orders?: {
      produtoId?: string;
      centroTrabalhoId?: string | null;
      quantidade?: ReturnType<typeof mockDecimal>;
      dataNecessidade?: Date;
    }[],
  ) => {
    if (orders === undefined) {
      mockPrismaService.ordemPlanejada.findMany.mockResolvedValue([]);
      return;
    }

    mockPrismaService.ordemPlanejada.findMany.mockResolvedValue(
      orders.map((o) => ({
        produtoId: o.produtoId ?? 'prod-001',
        centroTrabalhoId: o.centroTrabalhoId ?? 'wc-001',
        quantidade: o.quantidade ?? mockDecimal(100),
        dataNecessidade: o.dataNecessidade ?? new Date(Date.UTC(2026, 2, 4)),
      })),
    );
  };

  /**
   * Setup routing data for the test products/work centers.
   */
  const setupRouting = (
    routings?: {
      produtoId?: string;
      centroTrabalhoId?: string;
      tempoSetupMinutos?: ReturnType<typeof mockDecimal>;
      tempoUnitarioMinutos?: ReturnType<typeof mockDecimal>;
    }[],
  ) => {
    if (routings === undefined) {
      mockPrismaService.roteiroProducao.findMany.mockResolvedValue([]);
      return;
    }

    mockPrismaService.roteiroProducao.findMany.mockResolvedValue(
      routings.map((r) => ({
        produtoId: r.produtoId ?? 'prod-001',
        centroTrabalhoId: r.centroTrabalhoId ?? 'wc-001',
        tempoSetupMinutos: r.tempoSetupMinutos ?? mockDecimal(30),
        tempoUnitarioMinutos: r.tempoUnitarioMinutos ?? mockDecimal(0.5),
      })),
    );
  };

  // ────────────────────────────────────────────────────────────────
  // Test 1: Normal load (<100%) — AC-1, AC-4
  // ────────────────────────────────────────────────────────────────

  describe('Normal load (<100%) — AC-1, AC-4', () => {
    it('should calculate utilization < 100% with sugestao = OK', async () => {
      // 5 working days * 8h/day * 100% efficiency = 40h available
      setupWorkCenter();
      setupCalendar();

      // Order: 100 units, setup=30min, unit=0.5min
      // Load = (30 + 100*0.5) / 60 = 80/60 = 1.3333h
      // Utilization = (1.3333/40)*100 = 3.33%
      setupProductionOrders([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          quantidade: mockDecimal(100),
          dataNecessidade: new Date(Date.UTC(2026, 2, 4)),
        },
      ]);
      setupRouting([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          tempoSetupMinutos: mockDecimal(30),
          tempoUnitarioMinutos: mockDecimal(0.5),
        },
      ]);

      const result = await service.calculateCrp(makeInput());

      expect(result.workCenters).toHaveLength(1);
      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.capacidadeDisponivelHoras).toBe(40);
      expect(week.cargaPlanejadaHoras).toBeCloseTo(1.3333, 3);
      expect(week.utilizacaoPercentual).toBeCloseTo(3.33, 1);
      expect(week.sobrecarga).toBe(false);
      expect(week.horasExcedentes).toBe(0);
      expect(week.sugestao).toBe('OK');
      expect(result.totalOverloadedWeeks).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 2: Overload 100-110% — HORA_EXTRA (AC-5)
  // ────────────────────────────────────────────────────────────────

  describe('Overload 100-110% — HORA_EXTRA — AC-5', () => {
    it('should suggest HORA_EXTRA when utilization is between 100% and 110%', async () => {
      // Available: 5 days * 8h * 100% = 40h
      setupWorkCenter();
      setupCalendar();

      // Need load ~42h (105%) → setup=0, unitTime=25.2min, qty=100
      // Load = (0 + 100 * 25.2) / 60 = 2520/60 = 42h
      // Utilization = (42/40)*100 = 105%
      setupProductionOrders([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          quantidade: mockDecimal(100),
          dataNecessidade: new Date(Date.UTC(2026, 2, 4)),
        },
      ]);
      setupRouting([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          tempoSetupMinutos: mockDecimal(0),
          tempoUnitarioMinutos: mockDecimal(25.2),
        },
      ]);

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.utilizacaoPercentual).toBe(105);
      expect(week.sobrecarga).toBe(true);
      expect(week.sugestao).toBe('HORA_EXTRA');
      expect(week.horasExcedentes).toBe(2);
      expect(result.totalOverloadedWeeks).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 3: Overload 110-130% — ANTECIPAR (AC-5)
  // ────────────────────────────────────────────────────────────────

  describe('Overload 110-130% — ANTECIPAR — AC-5', () => {
    it('should suggest ANTECIPAR when utilization is between 110% and 130%', async () => {
      // Available: 40h, Load: 48h → 120%
      setupWorkCenter();
      setupCalendar();

      // Load = (0 + 100 * 28.8) / 60 = 2880/60 = 48h → 120%
      setupProductionOrders([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          quantidade: mockDecimal(100),
          dataNecessidade: new Date(Date.UTC(2026, 2, 4)),
        },
      ]);
      setupRouting([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          tempoSetupMinutos: mockDecimal(0),
          tempoUnitarioMinutos: mockDecimal(28.8),
        },
      ]);

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.utilizacaoPercentual).toBe(120);
      expect(week.sobrecarga).toBe(true);
      expect(week.sugestao).toBe('ANTECIPAR');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 4: Overload >130% — SUBCONTRATAR (AC-5)
  // ────────────────────────────────────────────────────────────────

  describe('Overload >130% — SUBCONTRATAR — AC-5', () => {
    it('should suggest SUBCONTRATAR when utilization exceeds 130%', async () => {
      // Available: 40h, Load: 56h → 140%
      setupWorkCenter();
      setupCalendar();

      // Load = (0 + 100 * 33.6) / 60 = 3360/60 = 56h → 140%
      setupProductionOrders([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          quantidade: mockDecimal(100),
          dataNecessidade: new Date(Date.UTC(2026, 2, 4)),
        },
      ]);
      setupRouting([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          tempoSetupMinutos: mockDecimal(0),
          tempoUnitarioMinutos: mockDecimal(33.6),
        },
      ]);

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.utilizacaoPercentual).toBe(140);
      expect(week.sobrecarga).toBe(true);
      expect(week.sugestao).toBe('SUBCONTRATAR');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 5: Scheduled stop reduces available capacity (AC-3)
  // ────────────────────────────────────────────────────────────────

  describe('Scheduled stop reduces available capacity — AC-3', () => {
    it('should subtract scheduled stop hours from available capacity', async () => {
      // 40h base, 4h stop → 36h available
      setupWorkCenter({
        paradasProgramadas: [
          {
            // 4-hour stop on Wednesday
            dataInicio: new Date(Date.UTC(2026, 2, 4, 8, 0)), // Wed 08:00
            dataFim: new Date(Date.UTC(2026, 2, 4, 12, 0)), // Wed 12:00
          },
        ],
      });
      setupCalendar();
      setupProductionOrders();
      setupRouting();

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.capacidadeDisponivelHoras).toBe(36);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 6: Multiple shifts increase capacity (AC-3)
  // ────────────────────────────────────────────────────────────────

  describe('Multiple shifts increase capacity — AC-3', () => {
    it('should sum hours from multiple shifts per working day', async () => {
      // 2 shifts: 08:00-16:00 (8h) + 16:00-00:00 (8h) = 16h/day
      // 5 working days * 16h = 80h
      setupWorkCenter({
        turnos: [
          {
            horaInicio: makeTime(8, 0),
            horaFim: makeTime(16, 0),
            diasSemana: [1, 2, 3, 4, 5],
          },
          {
            id: 'turno-002',
            horaInicio: makeTime(16, 0),
            horaFim: makeTime(0, 0), // midnight — overnight handling
            diasSemana: [1, 2, 3, 4, 5],
          },
        ],
      });
      setupCalendar();
      setupProductionOrders();
      setupRouting();

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.capacidadeDisponivelHoras).toBe(80);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 7: No production orders — load = 0 (AC-1)
  // ────────────────────────────────────────────────────────────────

  describe('No production orders — load = 0 — AC-1', () => {
    it('should return zero load when no production orders exist', async () => {
      setupWorkCenter();
      setupCalendar();
      setupProductionOrders(); // empty
      setupRouting(); // empty

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.cargaPlanejadaHoras).toBe(0);
      expect(week.utilizacaoPercentual).toBe(0);
      expect(week.sobrecarga).toBe(false);
      expect(week.sugestao).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 8: Working days from CalendarioFabrica (AC-7)
  // ────────────────────────────────────────────────────────────────

  describe('Working days from CalendarioFabrica — AC-7', () => {
    it('should use only UTIL days from the calendar (3 days = 24h)', async () => {
      // Only 3 UTIL days instead of 5 → 3 * 8h = 24h
      setupWorkCenter();
      setupCalendar([
        '2026-03-02', // Mon
        '2026-03-03', // Tue
        '2026-03-04', // Wed
        // Thu and Fri are holidays
      ]);
      setupProductionOrders();
      setupRouting();

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.capacidadeDisponivelHoras).toBe(24);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 9: Overnight shift calculation (AC-3)
  // ────────────────────────────────────────────────────────────────

  describe('Overnight shift calculation — AC-3', () => {
    it('should correctly calculate duration for overnight shifts', async () => {
      // Overnight shift: 22:00-06:00 = 8h
      // 5 days * 8h = 40h
      setupWorkCenter({
        turnos: [
          {
            horaInicio: makeTime(22, 0), // 22:00
            horaFim: makeTime(6, 0), // 06:00 next day
            diasSemana: [1, 2, 3, 4, 5],
          },
        ],
      });
      setupCalendar();
      setupProductionOrders();
      setupRouting();

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.capacidadeDisponivelHoras).toBe(40);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 10: Zero available capacity — no division by zero (AC-4)
  // ────────────────────────────────────────────────────────────────

  describe('Zero available capacity — no division by zero — AC-4', () => {
    it('should return utilization = 0 when no working days (all holidays)', async () => {
      setupWorkCenter();
      setupCalendar([]); // No UTIL days — all holidays

      setupProductionOrders([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          quantidade: mockDecimal(100),
          dataNecessidade: new Date(Date.UTC(2026, 2, 4)),
        },
      ]);
      setupRouting([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          tempoSetupMinutos: mockDecimal(30),
          tempoUnitarioMinutos: mockDecimal(1),
        },
      ]);

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.capacidadeDisponivelHoras).toBe(0);
      expect(week.utilizacaoPercentual).toBe(0);
      expect(week.sobrecarga).toBe(false);
      expect(week.sugestao).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 11: Persistence — createMany called correctly (AC-6)
  // ────────────────────────────────────────────────────────────────

  describe('Persistence — createMany — AC-6', () => {
    it('should call prisma.cargaCapacidade.createMany with correct data', async () => {
      setupWorkCenter();
      setupCalendar();
      setupProductionOrders([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          quantidade: mockDecimal(50),
          dataNecessidade: new Date(Date.UTC(2026, 2, 4)),
        },
      ]);
      setupRouting([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          tempoSetupMinutos: mockDecimal(0),
          tempoUnitarioMinutos: mockDecimal(1),
        },
      ]);

      await service.calculateCrp(
        makeInput({ execucaoId: 'exec-persist-001' }),
      );

      expect(
        mockPrismaService.cargaCapacidade.createMany,
      ).toHaveBeenCalledTimes(1);

      const createCall =
        mockPrismaService.cargaCapacidade.createMany.mock.calls[0][0];
      expect(createCall.data).toHaveLength(1);
      expect(createCall.data[0].execucaoId).toBe('exec-persist-001');
      expect(createCall.data[0].centroTrabalhoId).toBe('wc-001');
      expect(createCall.data[0].periodo).toEqual(WEEK_START);
      expect(typeof createCall.data[0].capacidadeDisponivelHoras).toBe(
        'number',
      );
      expect(typeof createCall.data[0].cargaPlanejadaHoras).toBe('number');
      expect(typeof createCall.data[0].utilizacaoPercentual).toBe('number');
      expect(typeof createCall.data[0].sobrecarga).toBe('boolean');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 12: Read-only — does not modify orders (AC-12)
  // ────────────────────────────────────────────────────────────────

  describe('Read-only — does not modify orders — AC-12', () => {
    it('should not call any update/delete on ordemPlanejada', async () => {
      setupWorkCenter();
      setupCalendar();
      setupProductionOrders([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          quantidade: mockDecimal(100),
          dataNecessidade: new Date(Date.UTC(2026, 2, 4)),
        },
      ]);
      setupRouting([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          tempoSetupMinutos: mockDecimal(30),
          tempoUnitarioMinutos: mockDecimal(0.5),
        },
      ]);

      await service.calculateCrp(makeInput());

      // Verify only findMany was called on ordemPlanejada — no mutations
      expect(mockPrismaService.ordemPlanejada.findMany).toHaveBeenCalled();

      // Ensure no update/delete/create methods exist or were called on ordemPlanejada
      // The mock only has findMany — any additional call would throw
      const prismaCalls = Object.keys(mockPrismaService.ordemPlanejada);
      expect(prismaCalls).toEqual(['findMany']);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 13: No active work centers — warning
  // ────────────────────────────────────────────────────────────────

  describe('No active work centers — edge case', () => {
    it('should return empty results with warning when no work centers found', async () => {
      mockPrismaService.centroTrabalho.findMany.mockResolvedValue([]);

      const result = await service.calculateCrp(makeInput());

      expect(result.workCenters).toHaveLength(0);
      expect(result.totalOverloadedWeeks).toBe(0);
      expect(
        result.warnings.some((w) => w.includes('No active work centers')),
      ).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 14: Efficiency < 100% reduces available capacity
  // ────────────────────────────────────────────────────────────────

  describe('Efficiency reduces available capacity — AC-3', () => {
    it('should apply efficiency percentage to reduce capacity', async () => {
      // 5 days * 8h = 40h base, 80% efficiency → 32h available
      setupWorkCenter({ eficienciaPercentual: mockDecimal(80) });
      setupCalendar();
      setupProductionOrders();
      setupRouting();

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.capacidadeDisponivelHoras).toBe(32);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Test 15: Planned load formula — AC-2
  // ────────────────────────────────────────────────────────────────

  describe('Planned load formula — AC-2', () => {
    it('should calculate load = (setup + qty * unitTime) / 60', async () => {
      setupWorkCenter();
      setupCalendar();

      // setup = 60min, qty = 200, unitTime = 3min
      // Load = (60 + 200*3) / 60 = 660/60 = 11h
      setupProductionOrders([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          quantidade: mockDecimal(200),
          dataNecessidade: new Date(Date.UTC(2026, 2, 4)),
        },
      ]);
      setupRouting([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          tempoSetupMinutos: mockDecimal(60),
          tempoUnitarioMinutos: mockDecimal(3),
        },
      ]);

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.cargaPlanejadaHoras).toBe(11);
    });

    it('should sum load from multiple orders in the same week', async () => {
      setupWorkCenter();
      setupCalendar();

      // Order 1: (30 + 100*0.5) / 60 = 80/60 ≈ 1.3333h
      // Order 2: (30 + 100*0.5) / 60 = 80/60 ≈ 1.3333h
      // Total: ~2.6667h
      setupProductionOrders([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          quantidade: mockDecimal(100),
          dataNecessidade: new Date(Date.UTC(2026, 2, 3)),
        },
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          quantidade: mockDecimal(100),
          dataNecessidade: new Date(Date.UTC(2026, 2, 5)),
        },
      ]);
      setupRouting([
        {
          produtoId: 'prod-001',
          centroTrabalhoId: 'wc-001',
          tempoSetupMinutos: mockDecimal(30),
          tempoUnitarioMinutos: mockDecimal(0.5),
        },
      ]);

      const result = await service.calculateCrp(makeInput());

      const week = result.workCenters[0].weeklyCapacity[0];
      expect(week.cargaPlanejadaHoras).toBeCloseTo(2.6667, 3);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // determineSuggestion — direct unit tests
  // ────────────────────────────────────────────────────────────────

  describe('determineSuggestion — direct unit tests', () => {
    it('should return null for utilization = 0', () => {
      expect(service.determineSuggestion(0)).toBeNull();
    });

    it('should return OK for utilization = 50', () => {
      expect(service.determineSuggestion(50)).toBe('OK');
    });

    it('should return OK for utilization = 100', () => {
      expect(service.determineSuggestion(100)).toBe('OK');
    });

    it('should return HORA_EXTRA for utilization = 101', () => {
      expect(service.determineSuggestion(101)).toBe('HORA_EXTRA');
    });

    it('should return HORA_EXTRA for utilization = 110', () => {
      expect(service.determineSuggestion(110)).toBe('HORA_EXTRA');
    });

    it('should return ANTECIPAR for utilization = 111', () => {
      expect(service.determineSuggestion(111)).toBe('ANTECIPAR');
    });

    it('should return ANTECIPAR for utilization = 130', () => {
      expect(service.determineSuggestion(130)).toBe('ANTECIPAR');
    });

    it('should return SUBCONTRATAR for utilization = 131', () => {
      expect(service.determineSuggestion(131)).toBe('SUBCONTRATAR');
    });

    it('should return SUBCONTRATAR for utilization = 200', () => {
      expect(service.determineSuggestion(200)).toBe('SUBCONTRATAR');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // calculateShiftDurationHours — direct unit tests
  // ────────────────────────────────────────────────────────────────

  describe('calculateShiftDurationHours — direct', () => {
    it('should calculate 8 hours for 08:00-16:00', () => {
      const shift = {
        id: 's1',
        horaInicio: makeTime(8, 0),
        horaFim: makeTime(16, 0),
        diasSemana: [1, 2, 3, 4, 5],
        ativo: true,
        validoDesde: null,
        validoAte: null,
      };
      expect(service.calculateShiftDurationHours(shift)).toBe(8);
    });

    it('should calculate 8 hours for overnight shift 22:00-06:00', () => {
      const shift = {
        id: 's2',
        horaInicio: makeTime(22, 0),
        horaFim: makeTime(6, 0),
        diasSemana: [1, 2, 3, 4, 5],
        ativo: true,
        validoDesde: null,
        validoAte: null,
      };
      expect(service.calculateShiftDurationHours(shift)).toBe(8);
    });

    it('should calculate 24 hours for full-day shift 00:00-00:00', () => {
      const shift = {
        id: 's3',
        horaInicio: makeTime(0, 0),
        horaFim: makeTime(0, 0),
        diasSemana: [1, 2, 3, 4, 5],
        ativo: true,
        validoDesde: null,
        validoAte: null,
      };
      expect(service.calculateShiftDurationHours(shift)).toBe(24);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // isShiftValidForDate — direct unit tests
  // ────────────────────────────────────────────────────────────────

  describe('isShiftValidForDate — direct', () => {
    const baseShift = {
      id: 's1',
      horaInicio: makeTime(8, 0),
      horaFim: makeTime(16, 0),
      diasSemana: [1, 2, 3, 4, 5],
      ativo: true,
      validoDesde: null,
      validoAte: null,
    };

    it('should return true when no validity dates are set', () => {
      expect(
        service.isShiftValidForDate(baseShift, new Date(Date.UTC(2026, 2, 4))),
      ).toBe(true);
    });

    it('should return true when date is within validity range', () => {
      const shift = {
        ...baseShift,
        validoDesde: new Date(Date.UTC(2026, 0, 1)),
        validoAte: new Date(Date.UTC(2026, 11, 31)),
      };
      expect(
        service.isShiftValidForDate(shift, new Date(Date.UTC(2026, 5, 15))),
      ).toBe(true);
    });

    it('should return false when date is before validoDesde', () => {
      const shift = {
        ...baseShift,
        validoDesde: new Date(Date.UTC(2026, 5, 1)),
        validoAte: null,
      };
      expect(
        service.isShiftValidForDate(shift, new Date(Date.UTC(2026, 2, 4))),
      ).toBe(false);
    });

    it('should return false when date is after validoAte', () => {
      const shift = {
        ...baseShift,
        validoDesde: null,
        validoAte: new Date(Date.UTC(2026, 0, 1)),
      };
      expect(
        service.isShiftValidForDate(shift, new Date(Date.UTC(2026, 2, 4))),
      ).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Boundary: exactly 110% → HORA_EXTRA (AC-5)
  // ────────────────────────────────────────────────────────────────

  describe('Boundary tests — AC-5', () => {
    it('should return HORA_EXTRA at exactly 110%', () => {
      expect(service.determineSuggestion(110)).toBe('HORA_EXTRA');
    });

    it('should return ANTECIPAR at exactly 130%', () => {
      expect(service.determineSuggestion(130)).toBe('ANTECIPAR');
    });

    it('should return ANTECIPAR at 110.01%', () => {
      expect(service.determineSuggestion(110.01)).toBe('ANTECIPAR');
    });

    it('should return SUBCONTRATAR at 130.01%', () => {
      expect(service.determineSuggestion(130.01)).toBe('SUBCONTRATAR');
    });
  });
});
