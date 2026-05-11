import {
  ChartBarIcon,
  ClockIcon,
  CalendarDaysIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import StatCard from '@/components/ui/StatCard';

export default async function ErnestoDashboard() {
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard de Operaciones - Ernesto
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestión de reservas, ocupación y eficiencia operativa
          </p>
        </div>

        {/* Coming Soon Banner */}
        <div className="mb-8 bg-orange-50 border-l-4 border-orange-400 p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <CogIcon className="h-6 w-6 text-orange-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-orange-800">
                Dashboard en Construcción
              </h3>
              <div className="mt-2 text-sm text-orange-700">
                <p className="mb-2">
                  Tu dashboard personalizado está siendo desarrollado. Pronto tendrás acceso a:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Estado de reservas en tiempo real</li>
                  <li>Ocupación de servicios y cabañas</li>
                  <li>Calendario operativo del día</li>
                  <li>Gestión de comandas pendientes</li>
                  <li>Métricas de eficiencia operativa</li>
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
              title="Reservas Hoy"
              value="23"
              subtitle="15 completadas, 8 pendientes"
              icon={<CalendarDaysIcon className="h-6 w-6 text-orange-600" />}
            />
            <StatCard
              title="Ocupación"
              value="87%"
              subtitle="Promedio de la semana"
              icon={<ChartBarIcon className="h-6 w-6 text-orange-600" />}
            />
            <StatCard
              title="Tiempo Promedio"
              value="2.3h"
              subtitle="Duración por servicio"
              icon={<ClockIcon className="h-6 w-6 text-orange-600" />}
            />
            <StatCard
              title="Comandas Activas"
              value="12"
              subtitle="En preparación"
              icon={<CogIcon className="h-6 w-6 text-orange-600" />}
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
