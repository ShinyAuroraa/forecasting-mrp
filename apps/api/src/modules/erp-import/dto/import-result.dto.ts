export class ImportResultDto {
  tipo!: string;
  importados!: number;
  atualizados!: number;
  rejeitados!: number;
  erros!: ImportErrorDto[];
}

export class ImportErrorDto {
  linha?: number;
  codigo?: string;
  campo?: string;
  mensagem!: string;
}

export class ImportStatusDto {
  ultimaImportacao?: {
    tipo: string;
    data: string;
    resultado: ImportResultDto;
  };
  estatisticas: {
    produtos: number;
    seriesTemporais: number;
    inventario: number;
    composicoes: number;
  } = {
    produtos: 0,
    seriesTemporais: 0,
    inventario: 0,
    composicoes: 0,
  };
}
