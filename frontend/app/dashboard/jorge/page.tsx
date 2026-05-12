import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import StatCard from '@/components/ui/StatCard';
import { apiClient } from '@/lib/api/client';

// Helper para formatear números grandes
function formatNumber(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1000000).toFixed(1)}M`;
}

export default async function JorgeDashboard() {
  // Fetch datos reales de la API
  const statsResponse = await apiClient.getStatsOverview();

  // Datos por defecto en caso de error
  const defaultData = {
    meta_ads: {
      summary: { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, reach: 0 },
      campaigns_count: 0,
      recommendations: [],
      best_campaign: undefined,
      worst_campaign: undefined
    },
    bookings: {
      total: 48,
      revenue: 2840000,
      avg_ticket: 59167,
      status: 'mock_data',
      paid: undefined,
      pending: undefined,
      partial: undefined,
      by_family: undefined
    }
  };

  const stats = statsResponse.success ? statsResponse.data : defaultData;
  const metaAds = stats.meta_ads?.summary || defaultData.meta_ads.summary;
  const bookings = stats.bookings || defaultData.bookings;
  const isRealData = statsResponse.success && (stats.meta_ads?.campaigns_count ?? 0) > 0;
  const isBookingsReal = !stats.bookings.status || stats.bookings.status !== 'mock_data';

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard - Vista Gerencial
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Resumen ejecutivo de todas las operaciones de Aremko Spa
          </p>
        </div>

        {/* Meta Ads Stats */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Meta Ads - Última Semana
            </h2>
            {isRealData && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                🔄 Datos en vivo
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Gasto Total"
              value={metaAds.spend > 0 ? `$${metaAds.spend.toFixed(2)}` : '$0.00'}
              subtitle="USD"
              icon={<CurrencyDollarIcon className="h-6 w-6 text-blue-600" />}
            />
            <StatCard
              title="Impresiones"
              value={formatNumber(metaAds.impressions)}
              icon={<MegaphoneIcon className="h-6 w-6 text-blue-600" />}
            />
            <StatCard
              title="Clicks"
              value={formatNumber(metaAds.clicks)}
              icon={<ChartBarIcon className="h-6 w-6 text-blue-600" />}
            />
            <StatCard
              title="CTR"
              value={metaAds.ctr > 0 ? `${metaAds.ctr.toFixed(2)}%` : '0.00%'}
              subtitle="Click-Through Rate"
              icon={<ChartBarIcon className="h-6 w-6 text-blue-600" />}
            />
          </div>

          {/* Métricas adicionales de Meta Ads */}
          {isRealData && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mt-5">
              <StatCard
                title="CPC"
                value={metaAds.cpc > 0 ? `$${metaAds.cpc.toFixed(2)}` : '$0.00'}
                subtitle="Cost Per Click"
              />
              <StatCard
                title="CPM"
                value={metaAds.cpm > 0 ? `$${metaAds.cpm.toFixed(2)}` : '$0.00'}
                subtitle="Cost Per 1000 Impressions"
              />
              <StatCard
                title="Campañas Activas"
                value={stats.meta_ads?.campaigns_count || 0}
                subtitle="Con datos en este período"
              />
            </div>
          )}

          {/* Mejor y Peor Campaña */}
          {(stats.meta_ads?.best_campaign || stats.meta_ads?.worst_campaign) && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mt-5">
              {stats.meta_ads?.best_campaign && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">🏆 Mejor Campaña</h3>
                      <p className="mt-2 text-sm text-green-700 font-medium">
                        {stats.meta_ads.best_campaign.name}
                      </p>
                      <p className="mt-1 text-xs text-green-600">
                        CTR: {stats.meta_ads.best_campaign.ctr.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {stats.meta_ads?.worst_campaign && (
                <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-orange-800">⚠️ Campaña a Mejorar</h3>
                      <p className="mt-2 text-sm text-orange-700 font-medium">
                        {stats.meta_ads.worst_campaign.name}
                      </p>
                      <p className="mt-1 text-xs text-orange-600">
                        CTR: {stats.meta_ads.worst_campaign.ctr.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recomendaciones */}
          {stats.meta_ads?.recommendations && stats.meta_ads.recommendations.length > 0 && (
            <div className="mt-5 bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">💡 Recomendaciones</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <ul className="list-disc pl-5 space-y-1">
                      {stats.meta_ads.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Booking Stats */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Reservas - Última Semana
            </h2>
            {!isBookingsReal && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                📊 Datos de ejemplo
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Reservas Totales"
              value={bookings.total}
              icon={<UserGroupIcon className="h-6 w-6 text-green-600" />}
            />
            <StatCard
              title="Ingresos"
              value={`$${(bookings.revenue / 1000).toFixed(0)}K`}
              subtitle="CLP"
              icon={<CurrencyDollarIcon className="h-6 w-6 text-green-600" />}
            />
            <StatCard
              title="Ticket Promedio"
              value={`$${(bookings.avg_ticket / 1000).toFixed(0)}K`}
              subtitle="CLP"
              icon={<ChartBarIcon className="h-6 w-6 text-green-600" />}
            />
          </div>

          {/* Desglose de reservas por estado */}
          {isBookingsReal && (bookings.paid || bookings.pending || bookings.partial) && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mt-5">
              <StatCard
                title="Pagadas"
                value={bookings.paid || 0}
                subtitle="Confirmadas"
              />
              <StatCard
                title="Pendientes"
                value={bookings.pending || 0}
                subtitle="Por confirmar"
              />
              <StatCard
                title="Parciales"
                value={bookings.partial || 0}
                subtitle="Abono realizado"
              />
            </div>
          )}

          {/* Análisis por Familia de Servicios */}
          {isBookingsReal && bookings.by_family && bookings.by_family.length > 0 && (
            <div className="mt-5">
              <h3 className="text-md font-medium text-gray-900 mb-3">
                Ventas por Familia de Servicios (Primeros 11 días del mes)
              </h3>
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Familia
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Mayo 2026
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Abril 2026
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Mayo 2025
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bookings.by_family.map((family, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {family.family}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {family.current_count}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-600">
                            {family.previous_month_count}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-600">
                            {family.previous_year_count}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Acciones Rápidas
          </h2>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Generar Brief Semanal
              </button>
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Ver Campañas Activas
              </button>
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Análisis Competencia
              </button>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-8">
          {statsResponse.success ? (
            <div className="bg-green-50 border-l-4 border-green-400 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    <span className="font-medium">✅ Fase 2 activa - API conectada.</span>{' '}
                    Los datos de Meta Ads se obtienen en tiempo real desde la API.
                    {!isBookingsReal && ' Los datos de reservas son de ejemplo y se conectarán próximamente.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    <span className="font-medium">⚠️ Error de conexión con la API.</span>{' '}
                    {statsResponse.error || 'No se pudo conectar con el servidor backend.'}
                    Mostrando datos de ejemplo.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
