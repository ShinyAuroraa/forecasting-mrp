/**
 * Shared formatting utilities for the ForecastingMRP frontend.
 *
 * @see Story 3.11 — Purchasing Panel
 */

/**
 * Format a number as BRL currency (R$).
 *
 * @param value - Numeric value to format
 * @returns Formatted string in pt-BR locale (e.g., "R$ 1.234,56")
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Format a number with pt-BR locale separators.
 *
 * @param value - Numeric value to format
 * @returns Formatted string (e.g., "1.234,56")
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}
