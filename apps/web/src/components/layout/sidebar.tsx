'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  {
    label: 'Forecast',
    href: '/forecast',
    icon: '📈',
    children: [
      { label: 'Previsões', href: '/forecast' },
      { label: 'Cenários What-If', href: '/forecast/scenarios' },
    ],
  },
  {
    label: 'MRP',
    href: '/mrp',
    icon: '🏭',
    children: [
      { label: 'Visão Geral', href: '/mrp' },
      { label: 'Detalhamento', href: '/mrp/detail' },
      { label: 'Estoque', href: '/mrp/stock' },
      { label: 'Capacidade', href: '/mrp/capacity' },
    ],
  },
  { label: 'Compras', href: '/compras', icon: '🛒' },
  { label: 'Importacao ERP', href: '/importacao', icon: '📤' },
  { label: 'Ingestão', href: '/ingestao/templates', icon: '📥' },
  { label: 'Alertas', href: '/alertas', icon: '🔔' },
  {
    label: 'Automação',
    href: '/automacao',
    icon: '⚙️',
    children: [
      { label: 'Visão Geral', href: '/automacao' },
      { label: 'Pipeline', href: '/automacao/pipeline' },
      { label: 'Emails', href: '/automacao/emails' },
      { label: 'Agendamentos', href: '/automacao/schedule' },
      { label: 'Log', href: '/automacao/log' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.children) {
        const isActive = item.children.some((c) => pathname === c.href) || pathname === item.href;
        if (isActive) initial[item.href] = true;
      }
    }
    return initial;
  });

  const toggleMenu = (href: string) => {
    setOpenMenus((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  const isActive = (href: string) => pathname === href;
  const isGroupActive = (item: NavItem) =>
    pathname === item.href || (item.children?.some((c) => pathname === c.href) ?? false);

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-lg font-bold text-blue-600">ForecastingMRP</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700',
            collapsed ? 'mx-auto' : 'ml-auto',
          )}
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => (
            <li key={item.href}>
              {item.children ? (
                <>
                  <button
                    onClick={() => (collapsed ? undefined : toggleMenu(item.href))}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isGroupActive(item)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100',
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="text-base">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <span className="text-xs text-gray-400">
                          {openMenus[item.href] ? '▾' : '▸'}
                        </span>
                      </>
                    )}
                  </button>
                  {!collapsed && openMenus[item.href] && (
                    <ul className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              'block rounded-md px-3 py-1.5 text-sm transition-colors',
                              isActive(child.href)
                                ? 'bg-blue-100 font-medium text-blue-700'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="text-base">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">ForecastingMRP v1.0</p>
        </div>
      )}
    </aside>
  );
}
