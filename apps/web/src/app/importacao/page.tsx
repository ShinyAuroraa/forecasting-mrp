'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  useImportProdutos,
  useImportFaturamento,
  useImportMovimentacao,
  useImportInventario,
  useImportComposicao,
  useImportStatus,
  type ImportResult,
} from '@/hooks/use-erp-import';

interface ReportCardConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  ordem: number;
  multiple: boolean;
  hook: () => {
    mutateAsync: (file: File) => Promise<ImportResult>;
    isPending: boolean;
  };
  statKey?: 'produtos' | 'seriesTemporais' | 'inventario' | 'composicoes';
}

const REPORT_CARDS: ReportCardConfig[] = [
  {
    id: 'produtos',
    title: 'Produtos',
    description: 'Cadastro base de produtos (codigo, descricao, tipo, U.M.)',
    icon: '📦',
    ordem: 1,
    multiple: false,
    hook: useImportProdutos,
    statKey: 'produtos',
  },
  {
    id: 'composicao',
    title: 'Composicao (BOM)',
    description: 'Estrutura de produto: insumos, quantidades, % perda',
    icon: '🧩',
    ordem: 2,
    multiple: false,
    hook: useImportComposicao,
    statKey: 'composicoes',
  },
  {
    id: 'inventario',
    title: 'Inventario',
    description: 'Posicao geral de estoque por produto e grupo',
    icon: '📋',
    ordem: 3,
    multiple: false,
    hook: useImportInventario,
    statKey: 'inventario',
  },
  {
    id: 'faturamento',
    title: 'Faturamento',
    description: 'Faturamento agrupado mensal (qtde, kg, receita)',
    icon: '💰',
    ordem: 4,
    multiple: true,
    hook: useImportFaturamento,
    statKey: 'seriesTemporais',
  },
  {
    id: 'movimentacao',
    title: 'Movimentacao',
    description: 'Pedidos/movimentacao detalhada (agregado mensal)',
    icon: '📄',
    ordem: 5,
    multiple: true,
    hook: useImportMovimentacao,
    statKey: 'seriesTemporais',
  },
];

function ImportCard({ config }: { config: ReportCardConfig }) {
  const mutation = config.hook();
  const { data: status } = useImportStatus();
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) =>
        f.name.toLowerCase().endsWith('.pdf'),
      );
      if (fileArray.length === 0) return;

      setResults([]);
      setProgress({ current: 0, total: fileArray.length });

      for (let i = 0; i < fileArray.length; i++) {
        setCurrentFile(fileArray[i].name);
        setProgress({ current: i + 1, total: fileArray.length });
        try {
          const result = await mutation.mutateAsync(fileArray[i]);
          setResults((prev) => [...prev, result]);
        } catch (err) {
          setResults((prev) => [
            ...prev,
            {
              tipo: config.id,
              importados: 0,
              atualizados: 0,
              rejeitados: 0,
              erros: [
                {
                  mensagem:
                    err instanceof Error ? err.message : 'Erro ao processar PDF',
                },
              ],
            },
          ]);
        }
      }
      setCurrentFile('');
    },
    [mutation, config.id],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
    },
    [processFiles],
  );

  const totalImportados = results.reduce((s, r) => s + r.importados, 0);
  const totalAtualizados = results.reduce((s, r) => s + r.atualizados, 0);
  const totalRejeitados = results.reduce((s, r) => s + r.rejeitados, 0);
  const totalErros = results.reduce((s, r) => s + r.erros.length, 0);
  const statValue =
    status?.estatisticas && config.statKey
      ? status.estatisticas[config.statKey]
      : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{config.title}</h3>
            <p className="text-sm text-gray-500">{config.description}</p>
          </div>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
          #{config.ordem}
        </span>
      </div>

      {statValue !== null && (
        <div className="mb-3 text-xs text-gray-400">
          Registros no sistema: <span className="font-medium text-gray-600">{statValue}</span>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 transition-colors',
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          mutation.isPending && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple={config.multiple}
          onChange={handleFileChange}
          className="hidden"
        />
        {mutation.isPending ? (
          <div className="text-center">
            <div className="mb-2 h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
            <p className="text-sm text-blue-600">
              Processando {currentFile}...
            </p>
            {progress.total > 1 && (
              <p className="text-xs text-gray-400 mt-1">
                {progress.current} de {progress.total}
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Arraste o PDF aqui ou clique para selecionar
            </p>
            {config.multiple && (
              <p className="mt-1 text-xs text-gray-400">
                Suporta multiplos arquivos (12 meses)
              </p>
            )}
          </>
        )}
      </div>

      {/* Progress bar */}
      {mutation.isPending && progress.total > 1 && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-200">
          <div
            className="h-1.5 rounded-full bg-blue-500 transition-all"
            style={{
              width: `${(progress.current / progress.total) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex gap-3 text-sm">
            <span className="rounded bg-green-100 px-2 py-0.5 text-green-700">
              {totalImportados} importados
            </span>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700">
              {totalAtualizados} atualizados
            </span>
            {totalRejeitados > 0 && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">
                {totalRejeitados} rejeitados
              </span>
            )}
          </div>
          {totalErros > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer text-red-600">
                {totalErros} erro(s) - clique para ver
              </summary>
              <ul className="mt-1 max-h-32 overflow-y-auto space-y-1 pl-3">
                {results.flatMap((r, ri) =>
                  r.erros.map((e, ei) => (
                    <li key={`${ri}-${ei}`} className="text-red-500">
                      {e.codigo && <span className="font-mono">[{e.codigo}]</span>}{' '}
                      {e.mensagem}
                    </li>
                  )),
                )}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default function ImportacaoPage() {
  const { data: status } = useImportStatus();

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Importacao ERP WebMais
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Importe relatorios PDF do ERP WebMais para alimentar o sistema com
          dados reais. Siga a ordem numerada para garantir integridade
          referencial.
        </p>
      </div>

      {/* Stats overview */}
      {status && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Produtos', value: status.estatisticas.produtos },
            { label: 'Series Temporais', value: status.estatisticas.seriesTemporais },
            { label: 'Inventario', value: status.estatisticas.inventario },
            { label: 'Composicoes (BOM)', value: status.estatisticas.composicoes },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-gray-200 bg-white p-4 text-center"
            >
              <p className="text-2xl font-bold text-blue-600">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Import cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {REPORT_CARDS.map((config) => (
          <ImportCard key={config.id} config={config} />
        ))}
      </div>

      {/* Instructions */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="font-medium text-amber-800">Ordem de importacao</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-amber-700">
          <li>
            <strong>Produtos</strong> - cadastro base (obrigatorio primeiro)
          </li>
          <li>
            <strong>Composicao</strong> - estrutura BOM (depende de produtos)
          </li>
          <li>
            <strong>Inventario</strong> - posicao de estoque (depende de
            produtos)
          </li>
          <li>
            <strong>Faturamento</strong> - serie temporal mensal (depende de
            produtos)
          </li>
          <li>
            <strong>Movimentacao</strong> - detalhamento de pedidos (depende de
            produtos)
          </li>
        </ol>
      </div>
    </main>
  );
}
