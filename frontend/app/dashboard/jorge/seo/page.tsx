'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import type { SEORankings, SEOBacklinksSummary, SEOCompetitors } from '@/lib/types/api';

function formatNumber(n: number): string {
  if (n < 1000) return n.toLocaleString('es-CL');
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1000000).toFixed(2)}M`;
}

// Mismos 4 dominios que trackea el historial semanal en Django
// (aremko_cli_sync/management/commands/sync_aremko_cli_seo_rankings.py →
// DEFAULT_TARGETS, repo booking-system-aremko). Si se agrega o quita un
// competidor allá, reflejarlo acá también — no se leen de un endpoint común.
const TRACKED_DOMAINS: { domain: string; label: string }[] = [
  { domain: 'aremko.cl', label: 'Aremko' },
  { domain: 'cancagua.cl', label: 'Cancagua' },
  { domain: 'termasdelsol.com', label: 'Termas del Sol' },
  { domain: 'termascochamo.com', label: 'Termas Cochamó' },
];

function PositionBadge({ found, position }: { found: boolean; position?: number }) {
  if (!found || position == null) {
    return (
      <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
        —
      </span>
    );
  }
  const cls =
    position <= 3
      ? 'bg-green-100 text-green-800'
      : position <= 10
      ? 'bg-amber-100 text-amber-800'
      : 'bg-gray-100 text-gray-800';
  return <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${cls}`}>#{position}</span>;
}

export default function SEOPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Rankings de los 4 dominios trackeados, cargados en paralelo al entrar a la página.
  const [rankingsByDomain, setRankingsByDomain] = useState<Record<string, SEORankings | null>>({});

  // Dominio seleccionado para el detalle "quién aparece arriba" + backlinks + competidores.
  const [detailTarget, setDetailTarget] = useState<string>(TRACKED_DOMAINS[0].domain);

  const [backlinks, setBacklinks] = useState<SEOBacklinksSummary | null>(null);
  const [backlinksLoading, setBacklinksLoading] = useState(false);
  const [backlinksError, setBacklinksError] = useState<string | null>(null);

  const [competitors, setCompetitors] = useState<SEOCompetitors | null>(null);
  const [competitorsLoading, setCompetitorsLoading] = useState(false);
  const [competitorsError, setCompetitorsError] = useState<string | null>(null);

  const cargarComparativa = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const respuestas = await Promise.all(
        TRACKED_DOMAINS.map((d) => apiClient.getSEORankings(undefined, d.domain))
      );
      const next: Record<string, SEORankings | null> = {};
      const errores: string[] = [];
      respuestas.forEach((resp, i) => {
        const { domain } = TRACKED_DOMAINS[i];
        if (resp.success) {
          next[domain] = resp.data;
        } else {
          next[domain] = null;
          errores.push(`${domain}: ${resp.error || 'error desconocido'}`);
        }
      });
      setRankingsByDomain(next);
      if (errores.length) setError(errores.join(' · '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarComparativa();
  }, [cargarComparativa]);

  // Backlinks/competidores se resetean al cambiar de dominio seleccionado —
  // son consultas "bajo demanda" (botón Cargar), no se disparan solas.
  useEffect(() => {
    setBacklinks(null);
    setBacklinksError(null);
    setCompetitors(null);
    setCompetitorsError(null);
  }, [detailTarget]);

  const cargarBacklinks = async () => {
    try {
      setBacklinksLoading(true);
      setBacklinksError(null);
      const resp = await apiClient.getSEOBacklinks(detailTarget);
      if (resp.success) {
        setBacklinks(resp.data);
      } else {
        setBacklinksError(resp.error || 'Error al cargar backlinks');
      }
    } catch (err) {
      setBacklinksError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setBacklinksLoading(false);
    }
  };

  const cargarCompetitors = async () => {
    try {
      setCompetitorsLoading(true);
      setCompetitorsError(null);
      const resp = await apiClient.getSEOCompetitors(detailTarget);
      if (resp.success) {
        setCompetitors(resp.data);
      } else {
        setCompetitorsError(resp.error || 'Error al cargar competidores');
      }
    } catch (err) {
      setCompetitorsError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCompetitorsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando comparativa SEO (4 dominios)...</p>
        </div>
      </div>
    );
  }

  // Keywords en el orden que las devuelve Aremko (o el primer dominio con datos).
  const referencia = TRACKED_DOMAINS.map((d) => rankingsByDomain[d.domain]).find((r) => r && r.rankings.length > 0);
  const keywords = referencia ? referencia.rankings.map((r) => r.keyword) : [];

  const detailRankings = rankingsByDomain[detailTarget] ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SEO</h1>
          <p className="mt-2 text-sm text-gray-600">
            Rankings reales en Google, backlinks y competidores — vía DataForSEO. Complementa a
            Search Console mostrando lo que este nunca da: quién aparece arriba de Aremko, y cómo
            comparan los competidores directos en las mismas búsquedas.
          </p>
          {referencia && (
            <p className="mt-1 text-xs text-gray-500">
              {referencia.location} · {keywords.length} keywords trackeadas · {TRACKED_DOMAINS.length} dominios
            </p>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">Algunos dominios no cargaron</h3>
                <div className="mt-1 text-sm text-amber-700">
                  <p>Verifica DATAFORSEO_API_LOGIN / DATAFORSEO_API_PASSWORD en el backend.</p>
                  <p className="mt-1 text-xs">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comparativa: posición por keyword, 1 columna por dominio */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Aremko vs. competencia — posición por keyword</h2>
          </div>
          {keywords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Keyword
                    </th>
                    {TRACKED_DOMAINS.map((d) => (
                      <th
                        key={d.domain}
                        className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {keywords.map((keyword) => (
                    <tr key={keyword} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{keyword}</td>
                      {TRACKED_DOMAINS.map((d) => {
                        const r = rankingsByDomain[d.domain]?.rankings.find((x) => x.keyword === keyword);
                        return (
                          <td key={d.domain} className="px-4 py-4 text-center">
                            <PositionBadge found={!!r?.found} position={r?.position} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-gray-500">Sin datos de rankings todavía.</div>
          )}
        </div>

        {/* Selector de dominio para el detalle de abajo */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-600">Detalle de:</span>
          <div className="flex gap-1">
            {TRACKED_DOMAINS.map((d) => (
              <button
                key={d.domain}
                onClick={() => setDetailTarget(d.domain)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  detailTarget === d.domain
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detalle "quién aparece arriba" del dominio seleccionado */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Quién aparece arriba de {TRACKED_DOMAINS.find((d) => d.domain === detailTarget)?.label}
            </h2>
          </div>
          {detailRankings && detailRankings.rankings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Keyword
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Posición
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dominios arriba
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {detailRankings.rankings.map((r) => (
                    <tr key={r.keyword} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.keyword}</td>
                      <td className="px-6 py-4 text-right">
                        <PositionBadge found={r.found} position={r.position} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {r.competitors_above.length > 0 ? r.competitors_above.slice(0, 5).join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-gray-500">Sin datos de rankings todavía.</div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Backlinks (on-demand, del dominio seleccionado) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Backlinks — {TRACKED_DOMAINS.find((d) => d.domain === detailTarget)?.label}
              </h2>
              <button
                onClick={cargarBacklinks}
                disabled={backlinksLoading}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400"
              >
                {backlinksLoading ? 'Cargando…' : backlinks ? 'Actualizar' : 'Cargar'}
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-gray-500 mb-4">
                Consulta bajo demanda (recomendado ~1 vez al mes, no es de uso diario).
              </p>
              {backlinksError && <p className="text-sm text-red-600 mb-3">{backlinksError}</p>}
              {backlinks ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Backlinks totales</p>
                    <p className="text-xl font-bold text-gray-900">{formatNumber(backlinks.backlinks)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Dominios referentes</p>
                    <p className="text-xl font-bold text-gray-900">{formatNumber(backlinks.referring_domains)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Rank del dominio</p>
                    <p className="text-xl font-bold text-gray-900">{backlinks.rank}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Backlinks rotos</p>
                    <p className="text-xl font-bold text-gray-900">{formatNumber(backlinks.broken_backlinks)}</p>
                  </div>
                </div>
              ) : (
                !backlinksError && <p className="text-sm text-gray-400">Sin cargar todavía.</p>
              )}
            </div>
          </div>

          {/* Competidores (on-demand, del dominio seleccionado) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Competidores reales — {TRACKED_DOMAINS.find((d) => d.domain === detailTarget)?.label}
              </h2>
              <button
                onClick={cargarCompetitors}
                disabled={competitorsLoading}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400"
              >
                {competitorsLoading ? 'Cargando…' : competitors ? 'Actualizar' : 'Cargar'}
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-gray-500 mb-4">Por solapamiento de keywords en Google, no una lista adivinada.</p>
              {competitorsError && <p className="text-sm text-red-600 mb-3">{competitorsError}</p>}
              {competitors && competitors.competitors.length > 0 ? (
                <div className="space-y-2">
                  {competitors.competitors.slice(0, 8).map((c) => (
                    <div key={c.domain} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                      <span className="font-medium text-gray-900">{c.domain}</span>
                      <span className="text-gray-500">
                        {c.intersections} keywords en común · pos. media {c.avg_position.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                !competitorsError && <p className="text-sm text-gray-400">Sin cargar todavía.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
