import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCalendarioDto } from './dto/create-calendario.dto';
import { UpdateCalendarioDto } from './dto/update-calendario.dto';
import { FilterCalendarioDto } from './dto/filter-calendario.dto';
import { buildPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class CalendarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCalendarioDto) {
    return this.prisma.calendarioFabrica.create({
      data: {
        ...data,
        data: new Date(data.data),
      },
    });
  }

  async findAll(filters: FilterCalendarioDto) {
    const {
      startDate,
      endDate,
      tipo,
      page = 1,
      limit = 50,
      sortBy = 'data',
      sortOrder = 'asc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
      const dataFilter: Record<string, Date> = {};
      if (startDate) {
        dataFilter.gte = new Date(startDate);
      }
      if (endDate) {
        dataFilter.lte = new Date(endDate);
      }
      where.data = dataFilter;
    }

    if (tipo) {
      where.tipo = tipo;
    }

    const [data, total] = await Promise.all([
      this.prisma.calendarioFabrica.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.calendarioFabrica.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.calendarioFabrica.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: UpdateCalendarioDto) {
    const updateData: Record<string, unknown> = { ...data };
    if (data.data) {
      updateData.data = new Date(data.data);
    }

    return this.prisma.calendarioFabrica.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    return this.prisma.calendarioFabrica.delete({
      where: { id },
    });
  }

  async bulkCreate(entries: CreateCalendarioDto[]) {
    const data = entries.map((entry) => ({
      ...entry,
      data: new Date(entry.data),
    }));

    return this.prisma.calendarioFabrica.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async countWorkingDays(start: Date, end: Date): Promise<number> {
    return this.prisma.calendarioFabrica.count({
      where: {
        tipo: 'UTIL',
        data: { gte: start, lte: end },
      },
    });
  }
}
