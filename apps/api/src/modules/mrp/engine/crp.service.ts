import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CrpInput,
  CrpOutput,
  CrpWeekResult,
  CrpWorkCenterResult,
  WeeklyBucket,
} from './interfaces/crp.interface';

/**
 * Number of minutes in one hour — used for time unit conversion.
 */
const MINUTES_PER_HOUR = 60;

/**
 * Number of milliseconds in one hour — used for shift duration calculation.
 */
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Number of milliseconds in 24 hours — used for overnight shift handling.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Decimal precision for rounding (4 decimal places for hours).
 */
const HOURS_DECIMAL_PLACES = 4;
const HOURS_ROUNDING_FACTOR = Math.pow(10, HOURS_DECIMAL_PLACES);

/**
 * Decimal precision for rounding percentages (2 decimal places).
 */
const PERCENT_DECIMAL_PLACES = 2;
const PERCENT_ROUNDING_FACTOR = Math.pow(10, PERCENT_DECIMAL_PLACES);

/**
 * Capacity suggestion thresholds (AC-5).
 */
const THRESHOLD_HORA_EXTRA = 110;
const THRESHOLD_ANTECIPAR = 130;

/**
 * Work center data loaded from the database, including shifts and scheduled stops.
 */
interface WorkCenterData {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly eficienciaPercentual: number;
  readonly turnos: readonly ShiftData[];
  readonly paradasProgramadas: readonly ScheduledStopData[];
}

/**
 * Shift data from the Turno model.
 */
interface ShiftData {
  readonly id: string;
  readonly horaInicio: Date;
  readonly horaFim: Date;
  readonly diasSemana: readonly number[];
  readonly ativo: boolean;
  readonly validoDesde: Date | null;
  readonly validoAte: Date | null;
}

/**
 * Scheduled stop data from the ParadaProgramada model.
 */
interface ScheduledStopData {
  readonly dataInicio: Date;
  readonly dataFim: Date;
}

/**
 * Routing data from RoteiroProducao, mapping product + work center to times.
 */
interface RoutingData {
  readonly produtoId: string;
  readonly centroTrabalhoId: string;
  readonly tempoSetupMinutos: number;
  readonly tempoUnitarioMinutos: number;
}

/**
 * Production order data from OrdemPlanejada (tipo = PRODUCAO).
 */
interface ProductionOrderData {
  readonly produtoId: string;
  readonly centroTrabalhoId: string | null;
  readonly quantidade: number;
  readonly dataNecessidade: Date;
}

/**
 * CrpService — Capacity Requirements Planning Engine
 *
 * Calculates planned load per work center per week from production orders,
 * compares against available capacity (shifts, efficiency, scheduled stops,
 * and factory calendar), determines utilization percentage, and suggests
 * corrective actions for overloaded periods. Persists results to the
 * carga_capacidade table.
 *
 * Key design decisions:
 *   - AC-1: Calculates planned load per work center per week from PRODUCAO orders
 *   - AC-2: Planned load = sum of (tempoSetupMinutos + qty * tempoUnitarioMinutos) / 60
 *   - AC-3: Available capacity = working days * shift hours * (efficiency / 100) - stops
 *   - AC-4: Utilization = (planned load / available capacity) * 100
 *   - AC-5: Overload rules: <=110% HORA_EXTRA, 110-130% ANTECIPAR, >130% SUBCONTRATAR
 *   - AC-6: Results persisted to carga_capacidade table
 *   - AC-7: Working days from CalendarioFabrica (tipo = UTIL count per week)
 *   - AC-12: Does NOT modify planned orders — read-only validation
 *
 * @see Story 3.9 — CRP & Storage Capacity Validation
 * @see FR-040 — Capacity Requirements Planning
 */
@Injectable()
export class CrpService {
  private readonly logger = new Logger(CrpService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate capacity requirements for all active work centers.
   *
   * Loads work centers with their shifts and scheduled stops, production orders
   * for the given execution, routing data, and calendar data. Then calculates
   * available capacity and planned load per work center per week.
   *
   * @param input - Execution context and weekly time buckets
   * @returns CRP results per work center with utilization and suggestions
   */
  async calculateCrp(input: CrpInput): Promise<CrpOutput> {
    const warnings: string[] = [];

    this.logger.log(
      `Starting CRP calculation for execucao ${input.execucaoId}: ` +
        `${input.weeklyBuckets.length} weekly bucket(s)`,
    );

    // Load all required data
    const workCenters = await this.loadActiveWorkCenters();
    const productionOrders = await this.loadProductionOrders(input.execucaoId);

    if (workCenters.length === 0) {
      warnings.push('No active work centers found — CRP calculation skipped');
      this.logger.warn(warnings[0]);
      return {
        execucaoId: input.execucaoId,
        workCenters: [],
        totalOverloadedWeeks: 0,
        warnings,
      };
    }

    // Collect unique product IDs and work center IDs for routing lookup
    const productIds = [...new Set(productionOrders.map((o) => o.produtoId))];
    const wcIds = workCenters.map((wc) => wc.id);
    const routingData = await this.loadRoutingData(productIds, wcIds);

    // Determine the overall date range from weekly buckets for calendar lookup
    const allStarts = input.weeklyBuckets.map((b) => b.periodStart.getTime());
    const allEnds = input.weeklyBuckets.map((b) => b.periodEnd.getTime());
    const overallStart = new Date(Math.min(...allStarts));
    const overallEnd = new Date(Math.max(...allEnds));
    const calendarDates = await this.loadCalendarData(overallStart, overallEnd);

    // Calculate CRP for each work center
    const workCenterResults: CrpWorkCenterResult[] = [];
    let totalOverloadedWeeks = 0;

    for (const wc of workCenters) {
      const weeklyCapacity: CrpWeekResult[] = [];

      for (const bucket of input.weeklyBuckets) {
        // AC-3: Calculate available capacity
        const availableHours = this.calculateAvailableCapacity(
          wc,
          wc.turnos,
          calendarDates,
          wc.paradasProgramadas,
          bucket.periodStart,
          bucket.periodEnd,
        );

        // AC-2: Calculate planned load
        const plannedHours = this.calculatePlannedLoad(
          productionOrders,
          routingData,
          wc.id,
          bucket.periodStart,
          bucket.periodEnd,
        );

        // AC-4: Utilization
        const utilization =
          availableHours > 0
            ? this.roundPercent((plannedHours / availableHours) * 100)
            : 0;

        // AC-5: Determine suggestion
        const sugestao = this.determineSuggestion(utilization);
        const sobrecarga = utilization > 100;
        const horasExcedentes = sobrecarga
          ? this.roundHours(plannedHours - availableHours)
          : 0;

        if (sobrecarga) {
          totalOverloadedWeeks++;
        }

        weeklyCapacity.push({
          periodStart: bucket.periodStart,
          capacidadeDisponivelHoras: this.roundHours(availableHours),
          cargaPlanejadaHoras: this.roundHours(plannedHours),
          utilizacaoPercentual: utilization,
          sobrecarga,
          horasExcedentes,
          sugestao,
        });
      }

      workCenterResults.push({
        centroTrabalhoId: wc.id,
        codigo: wc.codigo,
        nome: wc.nome,
        weeklyCapacity,
      });
    }

    // AC-6: Persist results
    await this.persistCrpResults(input.execucaoId, workCenterResults);

    this.logger.log(
      `CRP calculation complete: ${workCenterResults.length} work center(s), ` +
        `${totalOverloadedWeeks} overloaded week(s)`,
    );

    return {
      execucaoId: input.execucaoId,
      workCenters: workCenterResults,
      totalOverloadedWeeks,
      warnings,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Data Loading
  // ────────────────────────────────────────────────────────────────

  /**
   * Load all active work centers with their shifts and scheduled stops.
   *
   * @returns Array of active work centers with relations
   */
  async loadActiveWorkCenters(): Promise<readonly WorkCenterData[]> {
    const workCenters = await this.prisma.centroTrabalho.findMany({
      where: { ativo: true },
      include: {
        turnos: { where: { ativo: true } },
        paradasProgramadas: true,
      },
    });

    return workCenters.map((wc) => ({
      id: wc.id,
      codigo: wc.codigo,
      nome: wc.nome,
      eficienciaPercentual: this.toNumber(wc.eficienciaPercentual) ?? 100,
      turnos: wc.turnos.map((t) => ({
        id: t.id,
        horaInicio: t.horaInicio,
        horaFim: t.horaFim,
        diasSemana: t.diasSemana,
        ativo: t.ativo,
        validoDesde: t.validoDesde,
        validoAte: t.validoAte,
      })),
      paradasProgramadas: wc.paradasProgramadas.map((p) => ({
        dataInicio: p.dataInicio,
        dataFim: p.dataFim,
      })),
    }));
  }

  /**
   * Load production orders for a given execution (tipo = PRODUCAO).
   *
   * @param execucaoId - The planning execution identifier
   * @returns Array of production orders with relevant fields
   */
  async loadProductionOrders(
    execucaoId: string,
  ): Promise<readonly ProductionOrderData[]> {
    const orders = await this.prisma.ordemPlanejada.findMany({
      where: {
        execucaoId,
        tipo: 'PRODUCAO',
      },
      select: {
        produtoId: true,
        centroTrabalhoId: true,
        quantidade: true,
        dataNecessidade: true,
      },
    });

    return orders.map((o) => ({
      produtoId: o.produtoId,
      centroTrabalhoId: o.centroTrabalhoId,
      quantidade: this.toNumber(o.quantidade) ?? 0,
      dataNecessidade: o.dataNecessidade,
    }));
  }

  /**
   * Load routing data for the given products and work centers.
   *
   * @param productIds - Unique product identifiers
   * @param centroTrabalhoIds - Unique work center identifiers
   * @returns Array of routing records with time values
   */
  async loadRoutingData(
    productIds: readonly string[],
    centroTrabalhoIds: readonly string[],
  ): Promise<readonly RoutingData[]> {
    if (productIds.length === 0 || centroTrabalhoIds.length === 0) {
      return [];
    }

    const routings = await this.prisma.roteiroProducao.findMany({
      where: {
        produtoId: { in: [...productIds] },
        centroTrabalhoId: { in: [...centroTrabalhoIds] },
        ativo: true,
      },
    });

    return routings.map((r) => ({
      produtoId: r.produtoId,
      centroTrabalhoId: r.centroTrabalhoId,
      tempoSetupMinutos: this.toNumber(r.tempoSetupMinutos) ?? 0,
      tempoUnitarioMinutos: this.toNumber(r.tempoUnitarioMinutos) ?? 0,
    }));
  }

  /**
   * Load calendar data (tipo = UTIL dates) for the given date range.
   * Working days are those with tipo = UTIL in CalendarioFabrica.
   *
   * @param startDate - Start of the range (inclusive)
   * @param endDate - End of the range (exclusive)
   * @returns Set of ISO date strings representing working days
   */
  async loadCalendarData(
    startDate: Date,
    endDate: Date,
  ): Promise<ReadonlySet<string>> {
    const calendarEntries = await this.prisma.calendarioFabrica.findMany({
      where: {
        tipo: 'UTIL',
        data: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: { data: true },
    });

    return new Set(
      calendarEntries.map((entry) => entry.data.toISOString().split('T')[0]),
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Capacity Calculation (AC-3, AC-7)
  // ────────────────────────────────────────────────────────────────

  /**
   * Calculate available capacity for a work center in a given week.
   *
   * Available capacity = sum(daily shift hours for working days)
   *                      * (eficienciaPercentual / 100)
   *                      - scheduled stop hours in the period
   *
   * Working days are determined from CalendarioFabrica (tipo = UTIL).
   * For each working day, shift hours are summed from active Turnos where
   * that day's weekday is in the shift's diasSemana array.
   * Overnight shifts (horaFim < horaInicio) are handled by adding 24h.
   *
   * @param wc - Work center data with efficiency
   * @param shifts - Active shifts for this work center
   * @param workingDays - Set of ISO date strings (YYYY-MM-DD) for UTIL days
   * @param scheduledStops - Scheduled stops for this work center
   * @param weekStart - Start of the week (inclusive)
   * @param weekEnd - End of the week (exclusive)
   * @returns Available capacity in hours
   */
  calculateAvailableCapacity(
    wc: WorkCenterData,
    shifts: readonly ShiftData[],
    workingDays: ReadonlySet<string>,
    scheduledStops: readonly ScheduledStopData[],
    weekStart: Date,
    weekEnd: Date,
  ): number {
    let totalShiftHours = 0;

    // Iterate each day in the week
    const currentDate = new Date(weekStart.getTime());
    while (currentDate.getTime() < weekEnd.getTime()) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

      // AC-7: Only count hours on UTIL (working) days
      if (workingDays.has(dateStr)) {
        for (const shift of shifts) {
          // Check if shift is valid for this date
          if (!this.isShiftValidForDate(shift, currentDate)) {
            continue;
          }

          // Check if this day's weekday is in the shift's diasSemana
          if (!shift.diasSemana.includes(dayOfWeek)) {
            continue;
          }

          // Calculate shift duration in hours
          totalShiftHours += this.calculateShiftDurationHours(shift);
        }
      }

      // Move to next day
      currentDate.setTime(currentDate.getTime() + MS_PER_DAY);
    }

    // Apply efficiency
    const effectiveHours =
      totalShiftHours * (wc.eficienciaPercentual / 100);

    // Subtract scheduled stop hours that overlap with this week
    const stopHours = this.calculateScheduledStopHours(
      scheduledStops,
      weekStart,
      weekEnd,
    );

    const available = effectiveHours - stopHours;
    return Math.max(0, available);
  }

  /**
   * Check if a shift is valid for a given date based on validoDesde/validoAte.
   *
   * @param shift - Shift data with optional validity dates
   * @param date - The date to check
   * @returns true if the shift is valid for this date
   */
  isShiftValidForDate(shift: ShiftData, date: Date): boolean {
    if (shift.validoDesde !== null) {
      const validFrom = new Date(shift.validoDesde);
      if (date.getTime() < validFrom.getTime()) {
        return false;
      }
    }

    if (shift.validoAte !== null) {
      const validUntil = new Date(shift.validoAte);
      if (date.getTime() > validUntil.getTime()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate shift duration in hours.
   * Handles overnight shifts where horaFim < horaInicio by adding 24 hours.
   *
   * @param shift - Shift with horaInicio and horaFim (Time values)
   * @returns Duration in hours
   */
  calculateShiftDurationHours(shift: ShiftData): number {
    const startMs = shift.horaInicio.getTime();
    const endMs = shift.horaFim.getTime();

    let durationMs = endMs - startMs;

    // Handle overnight shift: if end < start, the shift crosses midnight
    if (durationMs <= 0) {
      durationMs += MS_PER_DAY;
    }

    return durationMs / MS_PER_HOUR;
  }

  /**
   * Calculate total scheduled stop hours that overlap with a given period.
   *
   * @param stops - Scheduled stops for the work center
   * @param periodStart - Start of the period
   * @param periodEnd - End of the period
   * @returns Total stop hours overlapping with the period
   */
  calculateScheduledStopHours(
    stops: readonly ScheduledStopData[],
    periodStart: Date,
    periodEnd: Date,
  ): number {
    let totalStopHours = 0;

    for (const stop of stops) {
      // Calculate overlap between stop and period
      const overlapStart = Math.max(
        stop.dataInicio.getTime(),
        periodStart.getTime(),
      );
      const overlapEnd = Math.min(
        stop.dataFim.getTime(),
        periodEnd.getTime(),
      );

      if (overlapEnd > overlapStart) {
        totalStopHours += (overlapEnd - overlapStart) / MS_PER_HOUR;
      }
    }

    return totalStopHours;
  }

  // ────────────────────────────────────────────────────────────────
  // Planned Load Calculation (AC-1, AC-2)
  // ────────────────────────────────────────────────────────────────

  /**
   * Calculate planned load in hours for a specific work center in a given week.
   *
   * For each production order that falls within the week and is assigned to
   * (or routed through) this work center, calculates:
   *   load = (tempoSetupMinutos + qty * tempoUnitarioMinutos) / 60
   *
   * If no routing data exists for a product/WC combo, the order's contribution
   * is zero (it may be routed through a different work center).
   *
   * @param orders - All production orders for the execution
   * @param routing - Routing data mapping product+WC to setup/unit times
   * @param centroTrabalhoId - The work center to calculate load for
   * @param weekStart - Start of the week (inclusive)
   * @param weekEnd - End of the week (exclusive)
   * @returns Total planned load in hours
   */
  calculatePlannedLoad(
    orders: readonly ProductionOrderData[],
    routing: readonly RoutingData[],
    centroTrabalhoId: string,
    weekStart: Date,
    weekEnd: Date,
  ): number {
    let totalLoadHours = 0;

    for (const order of orders) {
      // Check if the order falls within this week
      const orderTime = order.dataNecessidade.getTime();
      if (orderTime < weekStart.getTime() || orderTime >= weekEnd.getTime()) {
        continue;
      }

      // Check if this order is for this work center (direct assignment or routing)
      const isDirectAssignment = order.centroTrabalhoId === centroTrabalhoId;

      // Find routing for this product and work center
      const route = routing.find(
        (r) =>
          r.produtoId === order.produtoId &&
          r.centroTrabalhoId === centroTrabalhoId,
      );

      if (route !== undefined) {
        // AC-2: load = (setup + qty * unitTime) / 60
        const loadMinutes =
          route.tempoSetupMinutos +
          order.quantidade * route.tempoUnitarioMinutos;
        totalLoadHours += loadMinutes / MINUTES_PER_HOUR;
      } else if (isDirectAssignment) {
        // Order is directly assigned to this WC but no routing data exists
        // This is an edge case; we cannot calculate load without routing times
        // The load contribution is 0, which is correct per the data model
      }
    }

    return totalLoadHours;
  }

  // ────────────────────────────────────────────────────────────────
  // Suggestion Determination (AC-5)
  // ────────────────────────────────────────────────────────────────

  /**
   * Determine the suggested corrective action based on utilization percentage.
   *
   * AC-5 rules:
   *   - utilization <= 100% → OK (no action needed)
   *   - utilization <= 110% → HORA_EXTRA (overtime)
   *   - utilization <= 130% → ANTECIPAR (advance production)
   *   - utilization > 130% → SUBCONTRATAR (subcontract)
   *
   * @param utilization - Utilization percentage
   * @returns Suggested action or null if utilization is 0 (no capacity)
   */
  determineSuggestion(
    utilization: number,
  ): 'OK' | 'HORA_EXTRA' | 'ANTECIPAR' | 'SUBCONTRATAR' | null {
    if (utilization === 0) {
      return null;
    }

    if (utilization <= 100) {
      return 'OK';
    }

    if (utilization <= THRESHOLD_HORA_EXTRA) {
      return 'HORA_EXTRA';
    }

    if (utilization <= THRESHOLD_ANTECIPAR) {
      return 'ANTECIPAR';
    }

    return 'SUBCONTRATAR';
  }

  // ────────────────────────────────────────────────────────────────
  // Persistence (AC-6)
  // ────────────────────────────────────────────────────────────────

  /**
   * Persist CRP results to the carga_capacidade table.
   *
   * Creates one record per work center per week with capacity metrics
   * and the suggested corrective action.
   *
   * @param execucaoId - The planning execution identifier
   * @param workCenters - Calculated CRP results per work center
   */
  async persistCrpResults(
    execucaoId: string,
    workCenters: readonly CrpWorkCenterResult[],
  ): Promise<void> {
    const records = workCenters.flatMap((wc) =>
      wc.weeklyCapacity.map((week) => ({
        execucaoId,
        centroTrabalhoId: wc.centroTrabalhoId,
        periodo: week.periodStart,
        capacidadeDisponivelHoras: week.capacidadeDisponivelHoras,
        cargaPlanejadaHoras: week.cargaPlanejadaHoras,
        utilizacaoPercentual: week.utilizacaoPercentual,
        sobrecarga: week.sobrecarga,
        horasExcedentes: week.horasExcedentes,
        sugestao: week.sugestao,
      })),
    );

    if (records.length > 0) {
      await this.prisma.cargaCapacidade.createMany({ data: records });

      this.logger.log(
        `Persisted ${records.length} CRP record(s) to carga_capacidade`,
      );
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ────────────────────────────────────────────────────────────────

  /**
   * Safely convert a Prisma Decimal or number to a JavaScript number.
   * Returns null if the value is null or undefined.
   */
  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'object' && 'toNumber' in value) {
      return (value as { toNumber: () => number }).toNumber();
    }
    return null;
  }

  /**
   * Round to 4 decimal places for hour values.
   */
  private roundHours(value: number): number {
    return (
      Math.round(value * HOURS_ROUNDING_FACTOR) / HOURS_ROUNDING_FACTOR
    );
  }

  /**
   * Round to 2 decimal places for percentage values.
   */
  private roundPercent(value: number): number {
    return (
      Math.round(value * PERCENT_ROUNDING_FACTOR) / PERCENT_ROUNDING_FACTOR
    );
  }
}
