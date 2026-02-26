/**
 * Shared enums for the ForecastingMRP system.
 * These enums are consumed by both the web frontend and the API backend.
 * The Python forecast-engine mirrors these using Python Enums.
 */

/** Tipo de produto no cadastro de itens */
export enum TipoProduto {
  ACABADO = 'ACABADO',
  SEMI_ACABADO = 'SEMI_ACABADO',
  INSUMO = 'INSUMO',
  EMBALAGEM = 'EMBALAGEM',
  MATERIA_PRIMA = 'MATERIA_PRIMA',
  REVENDA = 'REVENDA',
}

/** Prioridade de ordens de producao */
export enum PrioridadeOrdem {
  CRITICA = 'CRITICA',
  ALTA = 'ALTA',
  MEDIA = 'MEDIA',
  BAIXA = 'BAIXA',
}

/** Modelos de forecasting disponiveis */
export enum ModeloForecast {
  TFT = 'TFT',
  ETS = 'ETS',
  CROSTON = 'CROSTON',
  LGBM = 'LGBM',
  ENSEMBLE = 'ENSEMBLE',
}

/** Papeis de usuario no sistema */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}
