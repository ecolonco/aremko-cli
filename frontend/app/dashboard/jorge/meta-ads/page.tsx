'use client';

import { useState, useEffect } from 'react';
import {
  MegaphoneIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  EyeIcon,
  CursorArrowRaysIcon,
} from '@heroicons/react/24/outline';
import StatCard from '@/components/ui/StatCard';
import { apiClient } from '@/lib/api/client';
import type { MetaAdsSummary, Campaign } from '@/lib/types/api';

// Helper para formatear números grandes
function formatNumber(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1000000).toFixed(1)}M`;
}

// Helper para formatear dinero
function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

// Badge de estado de campaña
function CampaignStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    PAUSED: 'bg-yellow-100 text-yellow-800',
    DELETED: 'bg-red-100 text-red-800',
    ARCHIVED: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {status}
    </span>
  );
}

export default function MetaAdsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MetaAdsSummary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [summaryResponse, campaignsResponse] = await Promise.all([
          apiClient.getMetaAccountSummary(),
          apiClient.getMetaCampaigns(),
        ]);

        if (summaryResponse.success) {
          setSummary(summaryResponse.data);
        } else {
          setError(summaryResponse.error || 'Error al cargar datos de Meta Ads');
        }

        if (campaignsResponse.success) {
          setCampaigns(campaignsResponse.data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Datos por defecto
  const defaultSummary = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    campaigns: 0,
    period: { start: '', end: '' },
  };

  const displaySummary = summary || defaultSummary;
  const hasRealData = summary !== null && !error;

  if (loading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Cargando datos de Meta Ads...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Meta Ads</h1>
              <p className="mt-1 text-sm text-gray-500">
                Monitoreo y análisis de campañas publicitarias en Facebook e Instagram
              </p>
              {displaySummary.period.start && (
                <p className="mt-1 text-xs text-gray-400">
                  Período: {new Date(displaySummary.period.start).toLocaleDateString('es-CL')} -{' '}
                  {new Date(displaySummary.period.end).toLocaleDateString('es-CL')}
                </p>
              )}
            </div>
            {hasRealData && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                🔄 Datos en vivo
              </span>
            )}
          </div>
        </div>

        {/* Mensaje de error si no hay datos */}
        {error && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <span className="font-medium">⚠️ No se pudieron cargar los datos de Meta Ads.</span>
                  {' '}Verifica que las credenciales estén configuradas correctamente en el backend.
                  <br />
                  <span className="text-xs mt-1 block">
                    Error: {error}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Métricas principales */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Resumen de Rendimiento</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Gasto Total"
              value={formatCurrency(displaySummary.spend)}
              subtitle="USD"
              icon={<CurrencyDollarIcon className="h-6 w-6 text-blue-600" />}
            />
            <StatCard
              title="Impresiones"
              value={formatNumber(displaySummary.impressions)}
              icon={<EyeIcon className="h-6 w-6 text-purple-600" />}
            />
            <StatCard
              title="Clicks"
              value={formatNumber(displaySummary.clicks)}
              icon={<CursorArrowRaysIcon className="h-6 w-6 text-green-600" />}
            />
            <StatCard
              title="Alcance"
              value={formatNumber(displaySummary.reach)}
              subtitle="Usuarios únicos"
              icon={<MegaphoneIcon className="h-6 w-6 text-orange-600" />}
            />
          </div>

          {/* Métricas secundarias */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mt-5">
            <StatCard
              title="CTR"
              value={`${displaySummary.ctr.toFixed(2)}%`}
              subtitle="Click-Through Rate"
              icon={<ChartBarIcon className="h-6 w-6 text-indigo-600" />}
            />
            <StatCard
              title="CPC"
              value={formatCurrency(displaySummary.cpc)}
              subtitle="Cost Per Click"
              icon={<CurrencyDollarIcon className="h-6 w-6 text-blue-600" />}
            />
            <StatCard
              title="CPM"
              value={formatCurrency(displaySummary.cpm)}
              subtitle="Cost Per 1000 Impressions"
              icon={<CurrencyDollarIcon className="h-6 w-6 text-blue-600" />}
            />
          </div>
        </div>

        {/* Tabla de campañas */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Campañas Activas ({campaigns.length})
            </h2>
          </div>

          {campaigns.length > 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Nombre de Campaña
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      ID
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Estado
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {campaign.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{campaign.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <CampaignStatusBadge status={campaign.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a
                          href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${campaign.id.split('_')[0]}&selected_campaign_ids=${campaign.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Ver en Meta
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white shadow sm:rounded-lg p-6 text-center">
              <MegaphoneIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No hay campañas disponibles
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {hasRealData
                  ? 'No se encontraron campañas activas en este período.'
                  : 'Configura las credenciales de Meta Ads para ver tus campañas.'}
              </p>
            </div>
          )}
        </div>

        {/* Próximamente */}
        <div className="mt-8">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Próximas funcionalidades
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Análisis detallado por campaña con gráficos históricos</li>
                    <li>Comparación de rendimiento entre campañas</li>
                    <li>Alertas automáticas para bajo rendimiento</li>
                    <li>Recomendaciones de optimización basadas en IA</li>
                    <li>Exportar reportes en PDF y Excel</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
