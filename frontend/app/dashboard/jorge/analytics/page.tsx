'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import type { StatsOverview } from '@/lib/types/api';

// Helper para formatear números grandes
function formatNumber(n: number): string {
  if (n < 1000) return n.toLocaleString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1000000).toFixed(2)}M`;
}

// Helper para formatear dinero
function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// Helper para formatear dinero con decimales
function formatCurrencyDetailed(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// Helper para formatear porcentaje de crecimiento
function formatGrowth(current: number, previous: number): { value: number; isPositive: boolean } {
  if (previous === 0) return { value: 0, isPositive: true };
  const growth = ((current - previous) / previous) * 100;
  return { value: Math.abs(growth), isPositive: growth >= 0 };
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.getStatsOverview();

        if (response.success) {
          setStats(response.data);
        } else {
          setError(response.error || 'Error al cargar estadísticas');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Error al cargar datos</h3>
          </div>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">No hay datos disponibles</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                Analytics
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Visión general del desempeño del negocio
              </p>
              {stats.period.start && (
                <p className="mt-1 text-xs text-gray-500">
                  Período: {new Date(stats.period.start).toLocaleDateString('es-CL')} - {new Date(stats.period.end).toLocaleDateString('es-CL')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700">En vivo</span>
            </div>
          </div>
        </div>

        {/* Web Analytics Section (www.aremko.cl) */}
        {stats.web_analytics && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Sitio Web <span className="text-sm font-normal text-gray-500">(www.aremko.cl)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Usuarios Activos */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Usuarios Activos</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {formatNumber(stats.web_analytics.active_users)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">En el período</p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Sesiones */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Sesiones</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {formatNumber(stats.web_analytics.sessions)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Visitas totales</p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Páginas Vistas */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Páginas Vistas</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {formatNumber(stats.web_analytics.page_views)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Páginas totales</p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Usuarios Nuevos */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Usuarios Nuevos</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {formatNumber(stats.web_analytics.new_users)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Primera visita</p>
                  </div>
                  <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Métricas Secundarias Web */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6">
                <p className="text-sm font-medium text-slate-600">Tasa de Rebote</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{(stats.web_analytics.bounce_rate * 100).toFixed(1)}%</p>
                <p className="mt-1 text-xs text-slate-500">Porcentaje de sesiones de una sola página</p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6">
                <p className="text-sm font-medium text-slate-600">Duración Promedio</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{Math.round(stats.web_analytics.avg_session_duration)}s</p>
                <p className="mt-1 text-xs text-slate-500">Tiempo promedio en el sitio</p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6">
                <p className="text-sm font-medium text-slate-600">Eventos</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(stats.web_analytics.event_count)}</p>
                <p className="mt-1 text-xs text-slate-500">Interacciones totales</p>
              </div>
            </div>
          </div>
        )}

        {/* Bookings Section */}
        {stats.bookings && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Reservas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Reservas */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Reservas</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {stats.bookings.total}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Revenue */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Ingresos</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {formatCurrency(stats.bookings.revenue)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">CLP</p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Ticket Promedio */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Ticket Promedio</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {formatCurrency(stats.bookings.avg_ticket)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">CLP</p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Estado */}
              {stats.bookings.status && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Estado</p>
                      <p className="mt-2 text-lg font-semibold text-gray-900">{stats.bookings.status}</p>
                      {stats.bookings.paid !== undefined && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-green-600">Pagado: {stats.bookings.paid}</p>
                          <p className="text-xs text-yellow-600">Pendiente: {stats.bookings.pending}</p>
                          <p className="text-xs text-blue-600">Parcial: {stats.bookings.partial}</p>
                        </div>
                      )}
                    </div>
                    <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bookings por Familia de Servicios */}
            {stats.bookings.by_family && stats.bookings.by_family.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Por Familia de Servicios</h3>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* Vista Desktop - Tabla */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Familia</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Reservas</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ingresos</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">vs Mes Anterior</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">vs Año Anterior</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {stats.bookings.by_family.map((family, idx) => {
                          const monthGrowth = formatGrowth(family.current_revenue, family.previous_month_revenue);
                          const yearGrowth = formatGrowth(family.current_revenue, family.previous_year_revenue);

                          return (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{family.family}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">{family.current_count}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">{formatCurrency(family.current_revenue)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <span className={`inline-flex items-center ${monthGrowth.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {monthGrowth.isPositive ? '↑' : '↓'} {monthGrowth.value.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <span className={`inline-flex items-center ${yearGrowth.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {yearGrowth.isPositive ? '↑' : '↓'} {yearGrowth.value.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista Móvil - Cards */}
                  <div className="lg:hidden divide-y divide-gray-200">
                    {stats.bookings.by_family.map((family, idx) => {
                      const monthGrowth = formatGrowth(family.current_revenue, family.previous_month_revenue);
                      const yearGrowth = formatGrowth(family.current_revenue, family.previous_year_revenue);

                      return (
                        <div key={idx} className="p-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-3">{family.family}</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500">Reservas</p>
                              <p className="text-sm font-medium text-gray-900">{family.current_count}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Ingresos</p>
                              <p className="text-sm font-medium text-gray-900">{formatCurrency(family.current_revenue)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">vs Mes Anterior</p>
                              <p className={`text-sm font-medium ${monthGrowth.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {monthGrowth.isPositive ? '↑' : '↓'} {monthGrowth.value.toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">vs Año Anterior</p>
                              <p className={`text-sm font-medium ${yearGrowth.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {yearGrowth.isPositive ? '↑' : '↓'} {yearGrowth.value.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Meta Ads Section */}
        {stats.meta_ads && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Publicidad Meta</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Gasto */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Gasto Total</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {formatCurrency(stats.meta_ads.summary.spend)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">USD</p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Impresiones */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Impresiones</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {formatNumber(stats.meta_ads.summary.impressions)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Vistas</p>
                  </div>
                  <div className="h-12 w-12 bg-pink-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Clicks */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Clicks</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {formatNumber(stats.meta_ads.summary.clicks)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Interacciones</p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Alcance */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Alcance</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {formatNumber(stats.meta_ads.summary.reach)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Usuarios únicos</p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Métricas Secundarias Meta Ads */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6">
                <p className="text-sm font-medium text-slate-600">CTR</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{stats.meta_ads.summary.ctr.toFixed(2)}%</p>
                <p className="mt-1 text-xs text-slate-500">Click-Through Rate</p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6">
                <p className="text-sm font-medium text-slate-600">CPC</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrencyDetailed(stats.meta_ads.summary.cpc)}</p>
                <p className="mt-1 text-xs text-slate-500">Cost Per Click</p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6">
                <p className="text-sm font-medium text-slate-600">CPM</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrencyDetailed(stats.meta_ads.summary.cpm)}</p>
                <p className="mt-1 text-xs text-slate-500">Cost Per 1000 Impressions</p>
              </div>
            </div>

            {/* Best/Worst Campaigns */}
            {(stats.meta_ads.best_campaign || stats.meta_ads.worst_campaign) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {stats.meta_ads.best_campaign && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-green-900">Mejor Campaña</h3>
                    </div>
                    <p className="text-sm font-medium text-green-800 mb-1">{stats.meta_ads.best_campaign.name}</p>
                    <p className="text-xs text-green-600">CTR: {stats.meta_ads.best_campaign.ctr.toFixed(2)}%</p>
                  </div>
                )}

                {stats.meta_ads.worst_campaign && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                        <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-amber-900">Necesita Atención</h3>
                    </div>
                    <p className="text-sm font-medium text-amber-800 mb-1">{stats.meta_ads.worst_campaign.name}</p>
                    <p className="text-xs text-amber-600">CTR: {stats.meta_ads.worst_campaign.ctr.toFixed(2)}%</p>
                  </div>
                )}
              </div>
            )}

            {/* Recommendations */}
            {stats.meta_ads.recommendations && stats.meta_ads.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-blue-900">Recomendaciones</h3>
                </div>
                <ul className="space-y-2">
                  {stats.meta_ads.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-blue-800">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
