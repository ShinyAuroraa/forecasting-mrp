import { Injectable, NotFoundException } from '@nestjs/common';
import { CentrosTrabalhoRepository } from './centros-trabalho.repository';
import { CreateCentroTrabalhoDto } from './dto/create-centro-trabalho.dto';
import { UpdateCentroTrabalhoDto } from './dto/update-centro-trabalho.dto';
import { FilterCentroTrabalhoDto } from './dto/filter-centro-trabalho.dto';

export interface CapacityInfo {
  effectiveCapacityPerHour: number;
  totalShiftHoursPerDay: Record<number, number>;
  dailyCapacity: Record<number, number>;
}

@Injectable()
export class CentrosTrabalhoService {
  constructor(private readonly repository: CentrosTrabalhoRepository) {}

  async create(dto: CreateCentroTrabalhoDto) {
    return this.repository.create(dto);
  }

  async findAll(filters: FilterCentroTrabalhoDto) {
    return this.repository.findAll(filters);
  }

  async findById(id: string) {
    const centro = await this.repository.findById(id);
    if (!centro) {
      throw new NotFoundException(`CentroTrabalho com id ${id} nao encontrado`);
    }
    return centro;
  }

  async findByIdWithCapacity(id: string) {
    const centro = await this.findById(id);
    const capacity = this.calculateCapacity(centro);
    return { ...centro, capacity };
  }

  async update(id: string, dto: UpdateCentroTrabalhoDto) {
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.repository.softDelete(id);
  }

  calculateCapacity(centro: any): CapacityInfo {
    const nominalCapacity = Number(centro.capacidadeHoraUnidades ?? 0);
    const efficiency = Number(centro.eficienciaPercentual ?? 100);
    const effectiveCapacityPerHour = nominalCapacity * efficiency / 100;

    const totalShiftHoursPerDay: Record<number, number> = {};
    const dailyCapacity: Record<number, number> = {};

    const turnos = centro.turnos ?? [];
    for (const turno of turnos) {
      const shiftHours = this.calculateShiftHours(turno.horaInicio, turno.horaFim);
      const diasSemana: number[] = turno.diasSemana ?? [];

      for (const dia of diasSemana) {
        totalShiftHoursPerDay[dia] = (totalShiftHoursPerDay[dia] ?? 0) + shiftHours;
        dailyCapacity[dia] = totalShiftHoursPerDay[dia] * effectiveCapacityPerHour;
      }
    }

    return { effectiveCapacityPerHour, totalShiftHoursPerDay, dailyCapacity };
  }

  private calculateShiftHours(inicio: Date | string, fim: Date | string): number {
    const start = inicio instanceof Date ? inicio : new Date(`1970-01-01T${inicio}`);
    const end = fim instanceof Date ? fim : new Date(`1970-01-01T${fim}`);

    let diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000; // overnight shift
    }

    return diffMs / (1000 * 60 * 60);
  }
}
