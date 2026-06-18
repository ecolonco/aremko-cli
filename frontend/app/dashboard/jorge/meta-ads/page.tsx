'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import type { MetaAdsSummary, RefugioCampaign } from '@/lib/types/api';
import RefugioCampaignSection from '@/components/refugio/RefugioCampaignSection';
import GestionCampana from './GestionCampana';

// Tipo extendido para campañas con métricas
interface CampaignWithMetrics {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  status?: string;
  account_id?: string;
  account_label?: string;
}

// Helper para formatear números grandes
function formatNumber(n: number): string {
  if (n < 1000) return n.toLocaleString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1000000).toFixed(2)}M`;
}

// Formato CLP entero. Las cuentas publicitarias de Aremko reportan en pesos
// chilenos (no USD como decía el código anterior).
function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

// Versión con un decimal para CPC/CPM en CLP cuando el monto es bajo.
function formatCurrencyDetailed(n: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(n);
}

export default function MetaAdsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MetaAdsSummary | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
  const [refugio, setRefugio] = useState<RefugioCampaign | null>(null);
  const [mounted, setMounted] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Filtro de estado de campaña. Por defecto solo las activas (lo operativo del día).
  const [filtroEstado, setFiltroEstado] = useState<'active' | 'paused' | 'all'>('active');

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryResponse, campaignsResponse, refugioResponse] = await Promise.all([
        apiClient.getMetaAccountSummary(),
        apiClient.getCampaignsWithInsights(),
        apiClient.getRefugioCampaign(),
      ]);

      if (summaryResponse.success) {
        setSummary(summaryResponse.data);
      } else {
        setError(summaryResponse.error || 'Error al cargar datos de Meta Ads');
      }

      if (campaignsResponse.success && campaignsResponse.data) {
        const campaignsData = Array.isArray(campaignsResponse.data)
          ? campaignsResponse.data
          : (campaignsResponse.data as any).data || [];
        setCampaigns(campaignsData);
      }

      if (refugioResponse.success && refugioResponse.data) {
        setRefugio(refugioResponse.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    cargar();
  }, [cargar]);

  // Tras una acción de gestión (pausar/activar/presupuesto): muestra aviso y recarga.
  const onCampaignAction = (msg: string, recargar: boolean) => {
    setAviso(msg);
    if (recargar) cargar();
  };

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

  // Campañas según el filtro de estado (ACTIVE vs el resto = pausadas).
  const filteredCampaigns = campaigns.filter((c) => {
    if (filtroEstado === 'all') return true;
    const activa = (c.status ?? '').toUpperCase() === 'ACTIVE';
    return filtroEstado === 'active' ? activa : !activa;
  });
  const conteoActivas = campaigns.filter((c) => (c.status ?? '').toUpperCase() === 'ACTIVE').length;
  const conteoPausadas = campaigns.length - conteoActivas;

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {aviso && (
          <div className="mb-4 flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-sm">
            <span>{aviso}</span>
            <button
              onClick={() => setAviso(null)}
              aria-label="Cerrar aviso"
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        )}
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                Meta Ads
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Análisis de campañas publicitarias en Facebook e Instagram
              </p>
              {displaySummary.period.start && (
                <p className="mt-1 text-xs text-gray-500">
                  Período: {new Date(displaySummary.period.start).toLocaleDateString('es-CL')} - {new Date(displaySummary.period.end).toLocaleDateString('es-CL')}
                </p>
              )}
            </div>
            {hasRealData && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">En vivo</span>
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">
                  No se pudieron cargar los datos
                </h3>
                <div className="mt-1 text-sm text-amber-700">
                  <p>Verifica la configuración de credenciales en el backend.</p>
                  <p className="mt-1 text-xs">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Campaña Refugio - vista dedicada (Leads/CPL como métricas primarias) */}
        {refugio && (
          <div className="mb-6">
            <RefugioCampaignSection data={refugio} />
          </div>
        )}

        {/* Métricas Principales - Grid Responsivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Gasto Total */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gasto Total</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {formatCurrency(displaySummary.spend)}
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
                  {formatNumber(displaySummary.impressions)}
                </p>
                <p className="mt-1 text-xs text-gray-500">Vistas</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  {formatNumber(displaySummary.clicks)}
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
                  {formatNumber(displaySummary.reach)}
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

        {/* Métricas Secundarias */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6">
            <p className="text-sm font-medium text-slate-600">CTR</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{displaySummary.ctr.toFixed(2)}%</p>
            <p className="mt-1 text-xs text-slate-500">Click-Through Rate</p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6">
            <p className="text-sm font-medium text-slate-600">CPC</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrencyDetailed(displaySummary.cpc)}</p>
            <p className="mt-1 text-xs text-slate-500">Cost Per Click</p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6">
            <p className="text-sm font-medium text-slate-600">CPM</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrencyDetailed(displaySummary.cpm)}</p>
            <p className="mt-1 text-xs text-slate-500">Cost Per 1000 Impressions</p>
          </div>
        </div>

        {/* Campañas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Campañas ({filteredCampaigns.length})
            </h2>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
              {([
                { key: 'active', label: `Activas (${conteoActivas})` },
                { key: 'paused', label: `Pausadas (${conteoPausadas})` },
                { key: 'all', label: `Todas (${campaigns.length})` },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFiltroEstado(opt.key)}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    filtroEstado === opt.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filteredCampaigns.length > 0 ? (
            <>
              {/* Vista Desktop - Tabla */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Campaña
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cuenta
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gasto
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Impresiones
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Clicks
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CTR
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CPC
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCampaigns.map((campaign) => (
                      <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 max-w-md truncate">
                            {campaign.name}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {campaign.account_label && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                              {campaign.account_label}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                          {formatCurrency(campaign.spend)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-600">
                          {formatNumber(campaign.impressions)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-600">
                          {formatNumber(campaign.clicks)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                            campaign.ctr > 3.0
                              ? 'bg-green-100 text-green-800'
                              : campaign.ctr > 1.5
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {campaign.ctr.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900">
                          {formatCurrencyDetailed(campaign.cpc)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <a
                              href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${campaign.id.split('_')[0]}&selected_campaign_ids=${campaign.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Ver detalles
                            </a>
                            <GestionCampana campaign={campaign} onResult={onCampaignAction} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vista Móvil - Cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {filteredCampaigns.map((campaign) => (
                  <div key={campaign.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-sm font-medium text-gray-900 flex-1">
                        {campaign.name}
                      </h3>
                      {campaign.account_label && (
                        <span className="inline-flex shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          {campaign.account_label}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Gasto</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(campaign.spend)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Impresiones</p>
                        <p className="text-sm font-semibold text-gray-900">{formatNumber(campaign.impressions)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Clicks</p>
                        <p className="text-sm font-semibold text-gray-900">{formatNumber(campaign.clicks)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">CTR</p>
                        <p className="text-sm font-semibold">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                            campaign.ctr > 3.0
                              ? 'bg-green-100 text-green-800'
                              : campaign.ctr > 1.5
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {campaign.ctr.toFixed(2)}%
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <a
                        href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${campaign.id.split('_')[0]}&selected_campaign_ids=${campaign.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Ver detalles en Meta →
                      </a>
                      <div className="mt-2">
                        <GestionCampana campaign={campaign} onResult={onCampaignAction} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No hay campañas disponibles
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {!hasRealData
                  ? 'Configura las credenciales de Meta Ads para ver tus campañas.'
                  : campaigns.length > 0
                  ? `No hay campañas ${
                      filtroEstado === 'active' ? 'activas' : filtroEstado === 'paused' ? 'pausadas' : ''
                    } en este período.`
                  : 'No se encontraron campañas en este período.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
