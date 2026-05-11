import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import StatCard from '@/components/ui/StatCard';

export default async function DeborahDashboard() {
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard de Ventas - Deborah
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Métricas de conversión, ROI de campañas y rendimiento de ventas
          </p>
        </div>

        {/* Coming Soon Banner */}
        <div className="mb-8 bg-blue-50 border-l-4 border-blue-400 p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <TrophyIcon className="h-6 w-6 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-blue-800">
                Dashboard en Construcción
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p className="mb-2">
                  Tu dashboard personalizado está siendo desarrollado. Pronto tendrás acceso a:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Métricas de conversión en tiempo real</li>
                  <li>ROI de campañas publicitarias</li>
                  <li>Pipeline de ventas y pronósticos</li>
                  <li>Análisis de clientes y segmentación</li>
                  <li>Comparativas mes a mes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Vista Previa de Métricas
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Conversión del Mes"
              value="24.5%"
              subtitle="+3.2% vs mes anterior"
              icon={<ChartBarIcon className="h-6 w-6 text-green-600" />}
            />
            <StatCard
              title="ROI Campañas"
              value="4.8x"
              subtitle="Retorno sobre inversión"
              icon={<CurrencyDollarIcon className="h-6 w-6 text-green-600" />}
            />
            <StatCard
              title="Nuevos Clientes"
              value="127"
              subtitle="Este mes"
              icon={<UserGroupIcon className="h-6 w-6 text-green-600" />}
            />
            <StatCard
              title="Ventas Totales"
              value="$18.2M"
              subtitle="CLP este mes"
              icon={<TrophyIcon className="h-6 w-6 text-green-600" />}
            />
          </div>
        </div>

        {/* Status Message */}
        <div className="mt-8">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Nota:</span> Los datos mostrados son de ejemplo.
              El dashboard completo estará disponible en la siguiente fase de desarrollo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
