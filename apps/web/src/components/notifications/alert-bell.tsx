'use client';

import { useState, useCallback } from 'react';
import { useAlertSummary, useAlertStream } from '@/hooks/use-notifications';
import { AlertDropdown } from './alert-dropdown';
import type { Alert } from '@/types/notifications';

/**
 * Alert Bell Icon
 *
 * Shows a bell icon with unacknowledged count badge in the topbar.
 * Clicking opens the alert dropdown panel.
 *
 * @see Story 4.4 — AC-13, AC-17, AC-18
 */
export function AlertBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<Alert | null>(null);
  const { data: summary } = useAlertSummary();

  const handleNewAlert = useCallback((alert: Alert) => {
    setToast(alert);
    setTimeout(() => setToast(null), 5000);
  }, []);

  useAlertStream(handleNewAlert);

  const count = summary?.totalUnacknowledged ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-full p-2 hover:bg-gray-100 transition-colors"
        aria-label={`Alertas${count > 0 ? ` (${count} não lidos)` : ''}`}
        data-testid="alert-bell"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full"
            data-testid="alert-badge"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <AlertDropdown onClose={() => setIsOpen(false)} />
      )}

      {toast && (
        <div
          className="fixed top-4 right-4 z-50 max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg p-4 animate-slide-in"
          role="alert"
          data-testid="alert-toast"
        >
          <div className="flex items-start gap-3">
            <span className="text-red-500 font-bold text-lg">!</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">
                {toast.titulo}
              </p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {toast.mensagem}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Fechar"
            >
              x
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
