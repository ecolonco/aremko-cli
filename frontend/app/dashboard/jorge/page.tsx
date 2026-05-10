import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import StatCard from '@/components/ui/StatCard';

// Datos de ejemplo - luego se conectarán a la API real
const mockData = {
  metaAds: {
    spend: 245.32,
    impressions: 45200,
    clicks: 892,
    ctr: 1.97,
  },
  bookings: {
    total: 48,
    revenue: 2840000,
    avgTicket: 59167,
  },
};

export default function JorgeDashboard() {
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
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Meta Ads - Última Semana
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Gasto Total"
              value={`$${mockData.metaAds.spend.toFixed(2)}`}
              subtitle="USD"
              icon={<CurrencyDollarIcon className="h-6 w-6 text-blue-600" />}
              trend={{ value: 12.5, isPositive: false }}
            />
            <StatCard
              title="Impresiones"
              value={mockData.metaAds.impressions.toLocaleString()}
              icon={<MegaphoneIcon className="h-6 w-6 text-blue-600" />}
              trend={{ value: 8.3, isPositive: true }}
            />
            <StatCard
              title="Clicks"
              value={mockData.metaAds.clicks.toLocaleString()}
              icon={<ChartBarIcon className="h-6 w-6 text-blue-600" />}
              trend={{ value: 15.2, isPositive: true }}
            />
            <StatCard
              title="CTR"
              value={`${mockData.metaAds.ctr}%`}
              subtitle="Click-Through Rate"
              icon={<ChartBarIcon className="h-6 w-6 text-blue-600" />}
              trend={{ value: 6.8, isPositive: true }}
            />
          </div>
        </div>

        {/* Booking Stats */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Reservas - Última Semana
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Reservas Totales"
              value={mockData.bookings.total}
              icon={<UserGroupIcon className="h-6 w-6 text-green-600" />}
              trend={{ value: 22.1, isPositive: true }}
            />
            <StatCard
              title="Ingresos"
              value={`$${(mockData.bookings.revenue / 1000).toFixed(0)}K`}
              subtitle="CLP"
              icon={<CurrencyDollarIcon className="h-6 w-6 text-green-600" />}
              trend={{ value: 18.7, isPositive: true }}
            />
            <StatCard
              title="Ticket Promedio"
              value={`$${(mockData.bookings.avgTicket / 1000).toFixed(0)}K`}
              subtitle="CLP"
              icon={<ChartBarIcon className="h-6 w-6 text-green-600" />}
              trend={{ value: 3.2, isPositive: false }}
            />
          </div>
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
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Fase 1 MVP en desarrollo.</span>{' '}
                  Este dashboard muestra datos de ejemplo. La integración con datos reales
                  se activará próximamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
