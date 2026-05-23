'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, AlertCircle, Users, RefreshCw, Download, Printer } from 'lucide-react';

interface EjeBucket {
  label: string;
  count: number;
  pct_total: number;
  pct_sistema_actual: number | null;
}

interface MatrixCell {
  valor?: string;
  estilo?: string;
  contexto?: string;
  count: number;
}

interface SegmentsResponse {
  total_clientes: number;
  n_sistema_actual: number;
  n_pre_sistema: number;
  ultima_actualizacion: string;
  meses_ventana: number;
  eje_valor: EjeBucket[];
  eje_estilo: EjeBucket[];
  eje_contexto: EjeBucket[];
  matriz_valor_x_estilo: MatrixCell[];
  matriz_estilo_x_contexto: MatrixCell[];
}

interface CohortRow {
  cliente_id: number;
  eje_valor: string;
  eje_estilo: string;
  eje_contexto: string;
  total_visitas: number;
  gasto_total: number;
  ticket_promedio: number;
  dias_desde_ultima_visita: number;
  antiguedad_meses: number;
  avg_cantidad_personas?: number | null;
  pct_finde?: number | null;
  pct_reservas_bundle?: number | null;
  tiene_email: boolean;
  tiene_telefono: boolean;
}

interface CohortResponse {
  filtros_aplicados: Record<string, string>;
  count_total: number;
  stats: {
    gasto_total_sum: number;
    gasto_total_avg: number;
    visitas_avg: number;
    ticket_promedio_avg: number;
    antiguedad_meses_avg: number;
  };
  clientes: CohortRow[];
  limit: number;
  order_by: string;
}

const valorColors: Record<string, string> = {
  'Campeón': 'bg-emerald-100 text-emerald-900 border-emerald-300',
  'Leal': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Gran Gastador Ocasional': 'bg-blue-50 text-blue-800 border-blue-200',
  'Regular': 'bg-sky-50 text-sky-800 border-sky-200',
  'En Prueba': 'bg-yellow-50 text-yellow-800 border-yellow-200',
  'En Riesgo': 'bg-orange-50 text-orange-800 border-orange-200',
  'Dormido': 'bg-red-50 text-red-800 border-red-200',
  'Perdido': 'bg-gray-100 text-gray-800 border-gray-300',
  'Pre-sistema': 'bg-purple-50 text-purple-800 border-purple-200',
};

export default function PerfilesPage() {
  const [segments, setSegments] = useState<SegmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCell, setSelectedCell] = useState<{ estilo?: string; valor?: string; contexto?: string } | null>(null);
  const [cohort, setCohort] = useState<CohortResponse | null>(null);
  const [loadingCohort, setLoadingCohort] = useState(false);
  const [cohortError, setCohortError] = useState<string | null>(null);

  const [analysisAI, setAnalysisAI] = useState<any>(null);
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/v1/clients/segments`);
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${res.status} — respuesta no es JSON. Inicio: "${text.slice(0, 120)}…"`);
      }
      if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setSegments(json.data);
    } catch (e: any) {
      setError(e?.message || 'Error cargando taxonomía');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  const fetchCohort = useCallback(async (filtros: { estilo?: string; valor?: string; contexto?: string }) => {
    setLoadingCohort(true);
    setCohortError(null);
    setCohort(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const q = new URLSearchParams();
      if (filtros.valor) q.set('eje_valor', filtros.valor);
      if (filtros.estilo) q.set('eje_estilo', filtros.estilo);
      if (filtros.contexto) q.set('eje_contexto', filtros.contexto);
      q.set('limit', '50');
      const res = await fetch(`${apiUrl}/api/v1/clients/cohort?${q.toString()}`);
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${res.status} — respuesta no es JSON`);
      }
      if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setCohort(json.data);
    } catch (e: any) {
      setCohortError(e?.message || 'Error cargando cohorte');
    } finally {
      setLoadingCohort(false);
    }
  }, []);

  const handleCellClick = (estilo: string, contexto: string) => {
    if (estilo === 'N/A (pre-sistema)' || contexto === 'N/A (pre-sistema)') return;
    setSelectedCell({ estilo, contexto });
    fetchCohort({ estilo, contexto });
  };

  const handleValorClick = (valor: string) => {
    if (valor === 'Pre-sistema') return;
    setSelectedCell({ valor });
    fetchCohort({ valor });
  };

  const handleGenerateAnalysis = async () => {
    setGeneratingAnalysis(true);
    setAnalysisError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/v1/analytics/profiles/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysisAI(data.analysis);
      } else {
        setAnalysisError(data.error || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      setAnalysisError(e?.message || 'Error de red al generar el análisis');
    } finally {
      setGeneratingAnalysis(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500 mr-2" />
        <span className="text-gray-600">Cargando taxonomía de clientes…</span>
      </div>
    );
  }

  if (error || !segments) {
    return (
      <div className="flex-1 p-8">
        <Card className="border-red-200">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-6 w-6 mx-auto text-red-600 mb-2" />
            <p className="text-red-700 font-medium">Error: {error}</p>
            <Button onClick={fetchSegments} variant="outline" className="mt-4">Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ultimaFecha = new Date(segments.ultima_actualizacion).toLocaleString('es-CL');
  const topCohorts = [...segments.matriz_estilo_x_contexto]
    .filter((c) => c.estilo !== 'N/A (pre-sistema)' && c.contexto !== 'N/A (pre-sistema)')
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2 no-print">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7" />
            Perfiles de Clientes
          </h2>
          <p className="text-muted-foreground text-sm">
            Taxonomía multidimensional: Valor × Estilo × Contexto · {segments.total_clientes.toLocaleString('es-CL')} clientes
            ({segments.n_sistema_actual.toLocaleString('es-CL')} sistema actual + {segments.n_pre_sistema.toLocaleString('es-CL')} pre-sistema)
          </p>
          <p className="text-xs text-gray-400 mt-1">Última actualización: {ultimaFecha}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={fetchSegments} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refrescar
          </Button>
          <Button onClick={() => window.print()} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Card Análisis IA */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-indigo-600" />
            Análisis con IA
          </CardTitle>
          <CardDescription>
            Análisis ejecutivo profundo de las cohortes con estrategia de retención y crecimiento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGenerateAnalysis}
            disabled={generatingAnalysis}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            {generatingAnalysis ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando análisis…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />Generar Análisis IA</>
            )}
          </Button>
          {analysisError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-700">{analysisError}</p>
            </div>
          )}
          {analysisAI && (
            <div className="mt-4 bg-white border border-indigo-200 rounded-md p-6">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: analysisAI.content
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>')
                    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>')
                    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
                    .replace(/\n\n/g, '<br/><br/>'),
                }}
              />
              <p className="text-xs text-gray-400 mt-4">
                Tokens: {analysisAI.input_tokens?.toLocaleString()} entrada · {analysisAI.output_tokens?.toLocaleString()} salida ·{' '}
                {(analysisAI.latency_ms / 1000).toFixed(1)}s
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribución por cada eje */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Eje Valor */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">💰 Eje Valor</CardTitle>
            <CardDescription className="text-xs">Estado de relación comercial (RFM)</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <tbody>
                {segments.eje_valor.map((b) => (
                  <tr
                    key={b.label}
                    onClick={() => handleValorClick(b.label)}
                    className={`cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${valorColors[b.label] || ''}`}
                  >
                    <td className="py-1.5 px-2 font-medium">{b.label}</td>
                    <td className="py-1.5 px-2 text-right">{b.count.toLocaleString('es-CL')}</td>
                    <td className="py-1.5 px-2 text-right text-gray-500">
                      {b.pct_sistema_actual != null ? `${b.pct_sistema_actual}%` : `${b.pct_total}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Eje Estilo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🎨 Eje Estilo</CardTitle>
            <CardDescription className="text-xs">Preferencia de servicios</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <tbody>
                {segments.eje_estilo
                  .filter((b) => b.label !== 'N/A (pre-sistema)')
                  .map((b) => (
                    <tr
                      key={b.label}
                      onClick={() => { setSelectedCell({ estilo: b.label }); fetchCohort({ estilo: b.label }); }}
                      className="cursor-pointer hover:bg-gray-50 border-b border-gray-100"
                    >
                      <td className="py-1.5 px-2 font-medium">{b.label}</td>
                      <td className="py-1.5 px-2 text-right">{b.count.toLocaleString('es-CL')}</td>
                      <td className="py-1.5 px-2 text-right text-gray-500">
                        {b.pct_sistema_actual != null ? `${b.pct_sistema_actual}%` : `${b.pct_total}%`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Eje Contexto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">👥 Eje Contexto</CardTitle>
            <CardDescription className="text-xs">Patrón de compañía y timing</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <tbody>
                {segments.eje_contexto
                  .filter((b) => b.label !== 'N/A (pre-sistema)')
                  .map((b) => (
                    <tr
                      key={b.label}
                      onClick={() => { setSelectedCell({ contexto: b.label }); fetchCohort({ contexto: b.label }); }}
                      className="cursor-pointer hover:bg-gray-50 border-b border-gray-100"
                    >
                      <td className="py-1.5 px-2 font-medium">{b.label}</td>
                      <td className="py-1.5 px-2 text-right">{b.count.toLocaleString('es-CL')}</td>
                      <td className="py-1.5 px-2 text-right text-gray-500">
                        {b.pct_sistema_actual != null ? `${b.pct_sistema_actual}%` : `${b.pct_total}%`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Top 7 Cohortes Accionables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🎯 Top 7 Cohortes Accionables</CardTitle>
          <CardDescription>Las combinaciones más grandes (excluyendo pre-sistema) — concentran el grueso del volumen activo. Click para drill-down.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {topCohorts.map((c, idx) => (
              <button
                key={`${c.estilo}-${c.contexto}`}
                onClick={() => handleCellClick(c.estilo!, c.contexto!)}
                className="text-left p-3 border border-gray-200 rounded-md hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">#{idx + 1}</span>
                  <span className="text-sm font-bold text-indigo-700">{c.count.toLocaleString('es-CL')} clientes</span>
                </div>
                <div className="mt-1 text-sm font-medium">{c.estilo}</div>
                <div className="text-xs text-gray-600">× {c.contexto}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cohort drill-down */}
      {selectedCell && (
        <Card className="border-indigo-300 border-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Drill-down: {Object.entries(selectedCell).filter(([, v]) => v).map(([k, v]) => `${k} = ${v}`).join(' · ')}</span>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedCell(null); setCohort(null); }}>Cerrar</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCohort && (
              <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando clientes…
              </div>
            )}
            {cohortError && !loadingCohort && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                Error: {cohortError}
              </div>
            )}
            {cohort && !loadingCohort && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 text-xs">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Total clientes</div>
                    <div className="font-bold text-base">{cohort.count_total.toLocaleString('es-CL')}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Gasto total</div>
                    <div className="font-bold text-base">${cohort.stats.gasto_total_sum.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Gasto promedio/cliente</div>
                    <div className="font-bold text-base">${cohort.stats.gasto_total_avg.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Visitas promedio</div>
                    <div className="font-bold text-base">{cohort.stats.visitas_avg.toFixed(1)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Antigüedad promedio</div>
                    <div className="font-bold text-base">{Math.round(cohort.stats.antiguedad_meses_avg)} meses</div>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  Mostrando {cohort.clientes.length} de {cohort.count_total} clientes (orden: gasto descendente).
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">ID</th>
                        <th className="px-2 py-1.5 text-left font-medium">Valor</th>
                        <th className="px-2 py-1.5 text-left font-medium">Estilo</th>
                        <th className="px-2 py-1.5 text-left font-medium">Contexto</th>
                        <th className="px-2 py-1.5 text-right font-medium">Visitas</th>
                        <th className="px-2 py-1.5 text-right font-medium">Gasto</th>
                        <th className="px-2 py-1.5 text-right font-medium">Ticket</th>
                        <th className="px-2 py-1.5 text-right font-medium">Días sin venir</th>
                        <th className="px-2 py-1.5 text-right font-medium">Antigüedad</th>
                        <th className="px-2 py-1.5 text-center font-medium">📧</th>
                        <th className="px-2 py-1.5 text-center font-medium">📱</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohort.clientes.map((row) => (
                        <tr key={row.cliente_id} className="border-t hover:bg-gray-50">
                          <td className="px-2 py-1.5 font-mono">{row.cliente_id}</td>
                          <td className="px-2 py-1.5">{row.eje_valor}</td>
                          <td className="px-2 py-1.5">{row.eje_estilo}</td>
                          <td className="px-2 py-1.5">{row.eje_contexto}</td>
                          <td className="px-2 py-1.5 text-right">{row.total_visitas}</td>
                          <td className="px-2 py-1.5 text-right font-medium">
                            ${row.gasto_total.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-2 py-1.5 text-right">${row.ticket_promedio.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</td>
                          <td className={`px-2 py-1.5 text-right ${row.dias_desde_ultima_visita > 180 ? 'text-red-600 font-medium' : ''}`}>
                            {row.dias_desde_ultima_visita}
                          </td>
                          <td className="px-2 py-1.5 text-right">{row.antiguedad_meses}m</td>
                          <td className="px-2 py-1.5 text-center">{row.tiene_email ? '✓' : '—'}</td>
                          <td className="px-2 py-1.5 text-center">{row.tiene_telefono ? '✓' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
