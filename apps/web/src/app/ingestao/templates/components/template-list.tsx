'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import type { MappingTemplate } from '@/types/ingestion';

interface TemplateListProps {
  readonly templates: readonly MappingTemplate[];
  readonly onEdit: (template: MappingTemplate) => void;
  readonly onDuplicate: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

const tipoFonteLabel: Record<string, string> = {
  CSV: 'CSV',
  XLSX: 'Excel',
  API: 'API',
  DB: 'Banco de Dados',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function TemplateList({
  templates,
  onEdit,
  onDuplicate,
  onDelete,
}: TemplateListProps) {
  if (templates.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        Nenhum template encontrado. Crie o primeiro template acima.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Colunas</TableHead>
          <TableHead>Usos</TableHead>
          <TableHead>Último Uso</TableHead>
          <TableHead>Atualizado</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => (
          <TableRow key={template.id}>
            <TableCell>
              <div>
                <p className="font-medium">{template.nome}</p>
                {template.descricao && (
                  <p className="text-xs text-gray-500">{template.descricao}</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="info">
                {tipoFonteLabel[template.tipoFonte] ?? template.tipoFonte}
              </Badge>
            </TableCell>
            <TableCell>{template.colunas.length}</TableCell>
            <TableCell>{template.usageCount}</TableCell>
            <TableCell>{formatDate(template.lastUsedAt)}</TableCell>
            <TableCell>{formatDate(template.updatedAt)}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => onEdit(template)}
                  className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDuplicate(template.id)}
                  className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Duplicar
                </button>
                <button
                  onClick={() => onDelete(template.id)}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Excluir
                </button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
