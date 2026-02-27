import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TipoProduto,
  FonteAtualizacao,
  Granularidade,
  TipoDeposito,
} from '../../generated/prisma/enums';
import {
  ImportResultDto,
  ImportErrorDto,
  ImportStatusDto,
} from './dto/import-result.dto';

const FORECAST_ENGINE_URL =
  process.env.FORECAST_ENGINE_URL || 'http://localhost:8000';

interface ProdutoDTO {
  codigo: string;
  descricao: string;
  tipo: string;
  unidade_medida: string;
}

interface FaturamentoDTO {
  codigo_produto: string;
  descricao: string;
  periodo: string;
  qtde_pecas: number;
  qtde_kg: number;
  preco_medio_kg: number;
  valor_bruto: number;
  valor_liquido: number;
  prazo_medio: number;
}

interface InventarioDTO {
  codigo_produto: string;
  descricao: string;
  unidade: string;
  grupo: string;
  quantidade: number;
}

interface ComposicaoDTO {
  produto_pai_codigo: string;
  produto_pai_descricao: string;
  produto_pai_unidade: string;
  peso_bruto: number;
  peso_liquido: number;
  rendimento: number;
  insumos: Array<{
    codigo: string;
    descricao: string;
    unidade: string;
    quantidade: number;
    perda_percentual: number;
  }>;
}

interface MovimentacaoResumoDTO {
  codigo_produto: string;
  descricao: string;
  periodo: string;
  total_quantidade: number;
  total_valor: number;
  num_pedidos: number;
}

const TIPO_PRODUTO_MAP: Record<string, TipoProduto> = {
  'PRODUTO ACABADO': TipoProduto.ACABADO,
  'MERCADORIA PARA REVENDA': TipoProduto.REVENDA,
  'MATERIA PRIMA': TipoProduto.MATERIA_PRIMA,
  'MATÉRIA PRIMA': TipoProduto.MATERIA_PRIMA,
  INSUMO: TipoProduto.INSUMO,
  EMBALAGEM: TipoProduto.EMBALAGEM,
  'INTERMEDIÁRIO': TipoProduto.SEMI_ACABADO,
  'SEMI ACABADO': TipoProduto.SEMI_ACABADO,
  'SEMI-ACABADO': TipoProduto.SEMI_ACABADO,
};

const UNIDADE_MAP: Record<string, string> = {
  CX: 'CX',
  BD: 'CX',
  KG: 'KG',
  UN: 'UN',
  LT: 'LT',
  L: 'LT',
  PC: 'PCT',
  PCT: 'PCT',
  SC: 'SC',
  FD: 'FD',
  GL: 'GL',
  TB: 'TB',
  BL: 'BL',
  GR: 'GR',
  ML: 'ML',
};

@Injectable()
export class ErpImportService {
  private readonly logger = new Logger(ErpImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async parsePdf(
    tipo: string,
    fileBuffer: Buffer,
    filename: string,
  ): Promise<unknown[]> {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: filename,
      contentType: 'application/pdf',
    });

    const url = `${FORECAST_ENGINE_URL}/parse-pdf/${tipo}`;
    this.logger.log(`Sending PDF to forecast-engine: ${url}`);

    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      timeout: 120_000,
      maxContentLength: 50 * 1024 * 1024,
    });
    return response.data;
  }

  async importProdutos(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<ImportResultDto> {
    const parsed = (await this.parsePdf(
      'produtos',
      fileBuffer,
      filename,
    )) as ProdutoDTO[];

    const result: ImportResultDto = {
      tipo: 'produtos',
      importados: 0,
      atualizados: 0,
      rejeitados: 0,
      erros: [],
    };

    for (const item of parsed) {
      try {
        const tipoProduto =
          TIPO_PRODUTO_MAP[item.tipo.toUpperCase()] || TipoProduto.ACABADO;
        const siglaUm =
          UNIDADE_MAP[item.unidade_medida.toUpperCase()] ||
          item.unidade_medida.toUpperCase();

        // Find or create UnidadeMedida
        const unidadeMedida = await this.prisma.unidadeMedida.upsert({
          where: { sigla: siglaUm },
          update: {},
          create: { sigla: siglaUm, nome: siglaUm },
        });

        const existing = await this.prisma.produto.findUnique({
          where: { codigo: item.codigo },
        });

        if (existing) {
          await this.prisma.produto.update({
            where: { codigo: item.codigo },
            data: {
              descricao: item.descricao,
              tipoProduto,
              unidadeMedidaId: unidadeMedida.id,
            },
          });
          result.atualizados++;
        } else {
          await this.prisma.produto.create({
            data: {
              codigo: item.codigo,
              descricao: item.descricao,
              tipoProduto,
              unidadeMedidaId: unidadeMedida.id,
            },
          });
          result.importados++;
        }
      } catch (error) {
        result.rejeitados++;
        result.erros.push(
          this.buildError(item.codigo, error),
        );
      }
    }

    this.logger.log(
      `Produtos import: ${result.importados} created, ${result.atualizados} updated, ${result.rejeitados} rejected`,
    );
    return result;
  }

  async importFaturamento(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<ImportResultDto> {
    const parsed = (await this.parsePdf(
      'faturamento',
      fileBuffer,
      filename,
    )) as FaturamentoDTO[];

    const result: ImportResultDto = {
      tipo: 'faturamento',
      importados: 0,
      atualizados: 0,
      rejeitados: 0,
      erros: [],
    };

    for (const item of parsed) {
      try {
        const produto = await this.prisma.produto.findUnique({
          where: { codigo: item.codigo_produto },
        });
        if (!produto) {
          result.rejeitados++;
          result.erros.push({
            codigo: item.codigo_produto,
            campo: 'codigo_produto',
            mensagem: `Produto ${item.codigo_produto} não encontrado. Importe produtos primeiro.`,
          });
          continue;
        }

        // Parse periodo "MM/YYYY" to first day of month
        const [month, year] = item.periodo.split('/');
        const dataReferencia = new Date(`${year}-${month}-01`);

        const existing = await this.prisma.serieTemporal.findFirst({
          where: {
            produtoId: produto.id,
            dataReferencia,
            granularidade: Granularidade.mensal,
          },
        });

        const data = {
          produtoId: produto.id,
          dataReferencia,
          granularidade: Granularidade.mensal,
          volume: item.qtde_kg || item.qtde_pecas,
          receita: item.valor_liquido || item.valor_bruto,
          fonte: 'ERP_WEBMAIS',
          qualidade: 100,
        };

        if (existing) {
          await this.prisma.serieTemporal.update({
            where: { id: existing.id },
            data,
          });
          result.atualizados++;
        } else {
          await this.prisma.serieTemporal.create({ data });
          result.importados++;
        }
      } catch (error) {
        result.rejeitados++;
        result.erros.push(
          this.buildError(item.codigo_produto, error),
        );
      }
    }

    this.logger.log(
      `Faturamento import: ${result.importados} created, ${result.atualizados} updated, ${result.rejeitados} rejected`,
    );
    return result;
  }

  async importMovimentacao(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<ImportResultDto> {
    const parsed = (await this.parsePdf(
      'movimentacao',
      fileBuffer,
      filename,
    )) as MovimentacaoResumoDTO[];

    const result: ImportResultDto = {
      tipo: 'movimentacao',
      importados: 0,
      atualizados: 0,
      rejeitados: 0,
      erros: [],
    };

    for (const item of parsed) {
      try {
        const produto = await this.prisma.produto.findUnique({
          where: { codigo: item.codigo_produto },
        });
        if (!produto) {
          result.rejeitados++;
          result.erros.push({
            codigo: item.codigo_produto,
            campo: 'codigo_produto',
            mensagem: `Produto ${item.codigo_produto} não encontrado.`,
          });
          continue;
        }

        const [month, year] = item.periodo.split('/');
        const dataReferencia = new Date(`${year}-${month}-01`);

        const existing = await this.prisma.serieTemporal.findFirst({
          where: {
            produtoId: produto.id,
            dataReferencia,
            granularidade: Granularidade.mensal,
            fonte: 'ERP_WEBMAIS_MOV',
          },
        });

        const data = {
          produtoId: produto.id,
          dataReferencia,
          granularidade: Granularidade.mensal,
          volume: item.total_quantidade,
          receita: item.total_valor,
          fonte: 'ERP_WEBMAIS_MOV',
          qualidade: 90,
        };

        if (existing) {
          await this.prisma.serieTemporal.update({
            where: { id: existing.id },
            data,
          });
          result.atualizados++;
        } else {
          await this.prisma.serieTemporal.create({ data });
          result.importados++;
        }
      } catch (error) {
        result.rejeitados++;
        result.erros.push(
          this.buildError(item.codigo_produto, error),
        );
      }
    }

    this.logger.log(
      `Movimentacao import: ${result.importados} created, ${result.atualizados} updated, ${result.rejeitados} rejected`,
    );
    return result;
  }

  async importInventario(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<ImportResultDto> {
    const parsed = (await this.parsePdf(
      'inventario',
      fileBuffer,
      filename,
    )) as InventarioDTO[];

    const result: ImportResultDto = {
      tipo: 'inventario',
      importados: 0,
      atualizados: 0,
      rejeitados: 0,
      erros: [],
    };

    // Get or create default deposit
    const deposito = await this.prisma.deposito.upsert({
      where: { codigo: 'PRINCIPAL' },
      update: {},
      create: {
        codigo: 'PRINCIPAL',
        nome: 'Depósito Principal',
        tipo: TipoDeposito.PRODUTO_ACABADO,
      },
    });

    for (const item of parsed) {
      try {
        const produto = await this.prisma.produto.findUnique({
          where: { codigo: item.codigo_produto },
        });
        if (!produto) {
          result.rejeitados++;
          result.erros.push({
            codigo: item.codigo_produto,
            campo: 'codigo_produto',
            mensagem: `Produto ${item.codigo_produto} não encontrado.`,
          });
          continue;
        }

        const existing = await this.prisma.inventarioAtual.findFirst({
          where: {
            produtoId: produto.id,
            depositoId: deposito.id,
            lote: null,
          },
        });

        const data = {
          produtoId: produto.id,
          depositoId: deposito.id,
          quantidadeDisponivel: item.quantidade,
          fonteAtualizacao: FonteAtualizacao.ERP_SYNC,
          dataUltimaContagem: new Date(),
        };

        if (existing) {
          await this.prisma.inventarioAtual.update({
            where: { id: existing.id },
            data,
          });
          result.atualizados++;
        } else {
          await this.prisma.inventarioAtual.create({ data });
          result.importados++;
        }
      } catch (error) {
        result.rejeitados++;
        result.erros.push(
          this.buildError(item.codigo_produto, error),
        );
      }
    }

    this.logger.log(
      `Inventario import: ${result.importados} created, ${result.atualizados} updated, ${result.rejeitados} rejected`,
    );
    return result;
  }

  async importComposicao(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<ImportResultDto> {
    const parsed = (await this.parsePdf(
      'composicao',
      fileBuffer,
      filename,
    )) as ComposicaoDTO[];

    const result: ImportResultDto = {
      tipo: 'composicao',
      importados: 0,
      atualizados: 0,
      rejeitados: 0,
      erros: [],
    };

    for (const comp of parsed) {
      try {
        const produtoPai = await this.prisma.produto.findUnique({
          where: { codigo: comp.produto_pai_codigo },
        });
        if (!produtoPai) {
          result.rejeitados++;
          result.erros.push({
            codigo: comp.produto_pai_codigo,
            campo: 'produto_pai_codigo',
            mensagem: `Produto pai ${comp.produto_pai_codigo} não encontrado.`,
          });
          continue;
        }

        for (const insumo of comp.insumos) {
          try {
            const produtoFilho = await this.prisma.produto.findUnique({
              where: { codigo: insumo.codigo },
            });
            if (!produtoFilho) {
              result.rejeitados++;
              result.erros.push({
                codigo: insumo.codigo,
                campo: 'insumo_codigo',
                mensagem: `Insumo ${insumo.codigo} (${insumo.descricao}) não encontrado no cadastro.`,
              });
              continue;
            }

            const siglaUm =
              UNIDADE_MAP[insumo.unidade.toUpperCase()] ||
              insumo.unidade.toUpperCase();
            const unidadeMedida = await this.prisma.unidadeMedida.upsert({
              where: { sigla: siglaUm },
              update: {},
              create: { sigla: siglaUm, nome: siglaUm },
            });

            const existing = await this.prisma.bom.findFirst({
              where: {
                produtoPaiId: produtoPai.id,
                produtoFilhoId: produtoFilho.id,
                versao: 1,
              },
            });

            const data = {
              produtoPaiId: produtoPai.id,
              produtoFilhoId: produtoFilho.id,
              quantidade: insumo.quantidade,
              unidadeMedidaId: unidadeMedida.id,
              perdaPercentual: insumo.perda_percentual,
              versao: 1,
              ativo: true,
            };

            if (existing) {
              await this.prisma.bom.update({
                where: { id: existing.id },
                data,
              });
              result.atualizados++;
            } else {
              await this.prisma.bom.create({ data });
              result.importados++;
            }
          } catch (error) {
            result.rejeitados++;
            result.erros.push(
              this.buildError(insumo.codigo, error),
            );
          }
        }
      } catch (error) {
        result.rejeitados++;
        result.erros.push(
          this.buildError(comp.produto_pai_codigo, error),
        );
      }
    }

    this.logger.log(
      `Composicao import: ${result.importados} created, ${result.atualizados} updated, ${result.rejeitados} rejected`,
    );
    return result;
  }

  async getStatus(): Promise<ImportStatusDto> {
    const [produtos, series, inventario, composicoes] = await Promise.all([
      this.prisma.produto.count(),
      this.prisma.serieTemporal.count(),
      this.prisma.inventarioAtual.count(),
      this.prisma.bom.count(),
    ]);

    return {
      estatisticas: {
        produtos,
        seriesTemporais: series,
        inventario,
        composicoes,
      },
    };
  }

  private buildError(codigo: string, error: unknown): ImportErrorDto {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido';
    this.logger.warn(`Import error for ${codigo}: ${message}`);
    return { codigo, mensagem: message };
  }
}
