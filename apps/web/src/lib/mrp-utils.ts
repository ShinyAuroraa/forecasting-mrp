/**
 * Shared MRP utility functions.
 *
 * @see Story 3.12 — MRP & Capacity Dashboards
 */

/**
 * Get the Monday of the week containing the given date (UTC).
 *
 * @param dateStr - ISO date string
 * @returns Date set to Monday 00:00:00 UTC of that week
 */
export function getWeekStart(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
}

/**
 * Format a week start date as dd/MM for display.
 *
 * @param weekStart - Date representing the start of a week
 * @returns Formatted string (e.g., "03/03")
 */
export function formatWeekLabel(weekStart: Date): string {
  const dd = String(weekStart.getUTCDate()).padStart(2, '0');
  const mm = String(weekStart.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/**
 * Escape HTML entities to prevent XSS in ECharts tooltip formatters.
 *
 * @param str - Raw string that may contain HTML characters
 * @returns Escaped string safe for HTML tooltip rendering
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
