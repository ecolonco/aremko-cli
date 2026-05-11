import {
  ChartBarIcon,
  MegaphoneIcon,
  DocumentTextIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import StatCard from '@/components/ui/StatCard';

export default async function AngelicaDashboard() {
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard de Marketing y Contenido - Angélica
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Rendimiento de campañas, métricas de contenido y calendario editorial
          </p>
        </div>

        {/* Coming Soon Banner */}
        <div className="mb-8 bg-purple-50 border-l-4 border-purple-400 p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <MegaphoneIcon className="h-6 w-6 text-purple-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-purple-800">
                Dashboard en Construcción
              </h3>
              <div className="mt-2 text-sm text-purple-700">
                <p className="mb-2">
                  Tu dashboard personalizado está siendo desarrollado. Pronto tendrás acceso a:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Performance de campañas publicitarias (Meta, Google, LinkedIn)</li>
                  <li>Engagement de contenido en redes sociales</li>
                  <li>Calendario editorial y programación de posts</li>
                  <li>Analytics de tráfico web y conversiones</li>
                  <li>ROI por canal de marketing</li>
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
              title="Alcance Total"
              value="124K"
              subtitle="Impresiones este mes"
              icon={<MegaphoneIcon className="h-6 w-6 text-purple-600" />}
            />
            <StatCard
              title="Engagement Rate"
              value="8.4%"
              subtitle="+1.2% vs mes anterior"
              icon={<ChartBarIcon className="h-6 w-6 text-purple-600" />}
            />
            <StatCard
              title="Posts Programados"
              value="45"
              subtitle="Para esta semana"
              icon={<CalendarIcon className="h-6 w-6 text-purple-600" />}
            />
            <StatCard
              title="CTR Promedio"
              value="3.2%"
              subtitle="Campañas activas"
              icon={<DocumentTextIcon className="h-6 w-6 text-purple-600" />}
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
