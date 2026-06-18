'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ============================================================================
// Tablero de Evolución (H-021) — métricas de la bandeja omnicanal.
// Consume los 4 endpoints de Django vía el proxy Go /api/v1/metrics/*.
// ============================================================================

const apiBase = () =>
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:8080';
const M = '/api/v1/metrics';

const clp = (n: number | null | undefined) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0,
      }).format(n);

// Fecha legible (dd-mm-aaaa) desde un ISO; si no parsea, devuelve el crudo.
const fechaCorta = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

interface CampanasResp {
  resumen: {
    generados: number;
    aprobados: number;
    enviados: number;
    respondieron: number;
    reservaron: number;
    ingreso_atribuido: number;
    costo_estimado: number | null;
    roi_neto: number | null;
    roas: number | null;
  };
  tarifa_plantilla_clp: number | null;
  series: {
    semana: string;
    generados?: number;
    aprobados?: number;
    enviados: number;
    costo: number | null;
    respondieron: number;
    reservaron: number;
    ingreso: number;
  }[];
}
interface ReservaItem {
  venta_id: number;
  cliente_nombre: string;
  fecha_reserva: string;
  fecha_atribucion?: string;
  total: number;
  servicios: { nombre: string; cantidad: number; valor: number }[];
}
interface ReservasResp {
  reservas: ReservaItem[];
  total_reservas?: number;
  total_ingreso?: number;
}
interface AgenteResp {
  resumen: {
    pct_sin_editar: number;
    delta_pts_8sem: number;
    aprendizajes_aprobados: number;
    tiempo_ahorrado_min_estim: number;
  };
  series: { semana: string; pct_sin_editar: number; escalados: number; pct_escalado: number }[];
}
interface CanalesResp {
  resumen: { backlog_actual: number; primera_respuesta_mediana_min: number };
  series: { semana: string; whatsapp: number; instagram: number; primera_respuesta_mediana_min: number }[];
}
interface MasajesResp {
  resumen: { cobertura_pct: number; tasa_respuesta_pct: number | null };
  nota?: string;
  series: { semana: string; programados: number; enviados: number; cobertura_pct: number }[];
}

async function getMetric<T>(tipo: string, weeks: number): Promise<T> {
  const res = await fetch(`${apiBase()}${M}/${tipo}?weeks=${weeks}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json as T;
}

async function getReservas(weeks: number, semana: string): Promise<ReservasResp> {
  const q = new URLSearchParams({ weeks: String(weeks) });
  if (semana) q.set('semana', semana);
  const res = await fetch(`${apiBase()}${M}/campanas/reservas?${q.toString()}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json as ReservasResp;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function Grafico({ children }: { children: React.ReactElement }) {
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  );
}

export default function EvolucionPage() {
  const [weeks, setWeeks] = useState(12);
  const [campanas, setCampanas] = useState<CampanasResp | null>(null);
  const [agente, setAgente] = useState<AgenteResp | null>(null);
  const [canales, setCanales] = useState<CanalesResp | null>(null);
  const [masajes, setMasajes] = useState<MasajesResp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Semana puntual seleccionada en el bloque Campañas ('' = todo el período).
  const [semana, setSemana] = useState('');
  const [reservas, setReservas] = useState<ReservaItem[]>([]);
  const [reservasErr, setReservasErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [c, a, ch, m] = await Promise.all([
        getMetric<CampanasResp>('campanas', weeks),
        getMetric<AgenteResp>('agente', weeks),
        getMetric<CanalesResp>('canales', weeks),
        getMetric<MasajesResp>('masajes', weeks),
      ]);
      setCampanas(c);
      setAgente(a);
      setCanales(ch);
      setMasajes(m);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar las métricas');
    } finally {
      setCargando(false);
    }
  }, [weeks]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Reservas atribuidas (drill-down, H-022): depende de la semana elegida.
  const cargarReservas = useCallback(async () => {
    try {
      const r = await getReservas(weeks, semana);
      setReservas(r.reservas || []);
      setReservasErr(null);
    } catch (e: unknown) {
      setReservas([]);
      setReservasErr(e instanceof Error ? e.message : 'No disponible');
    }
  }, [weeks, semana]);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  // Fuente del funnel: una semana puntual (de la serie) o todo el período (resumen).
  const semSel = semana && campanas ? campanas.series.find((s) => s.semana === semana) : null;
  const val = (k: 'generados' | 'aprobados' | 'enviados' | 'respondieron' | 'reservaron'): number | undefined =>
    semSel ? (semSel[k] as number | undefined) : campanas?.resumen[k];
  const ingresoScope = semSel ? semSel.ingreso : campanas?.resumen.ingreso_atribuido;
  const stages = campanas
    ? (
        [
          { l: 'Generados', v: val('generados'), c: '#85B7EB' },
          { l: 'Aprobados', v: val('aprobados'), c: '#378ADD' },
          { l: 'Enviados', v: val('enviados'), c: '#185FA5' },
          { l: 'Respondieron', v: val('respondieron'), c: '#5DCAA5' },
          { l: 'Reservaron', v: val('reservaron'), c: '#0F6E56' },
        ] as { l: string; v: number | undefined; c: string }[]
      ).filter((s) => s.v != null)
    : [];
  const fmax = Math.max(...stages.map((s) => s.v ?? 0), 1);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3 md:p-6">
      <div className="flex flex-shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight md:text-3xl">
            <TrendingUp className="h-6 w-6 flex-shrink-0 text-emerald-600 md:h-7 md:w-7" />
            Métricas / Evolución
          </h2>
          <p className="mt-1 hidden text-sm text-muted-foreground md:block">
            Cómo evoluciona la bandeja como motor de ventas: campañas y su ROI, el agente IA,
            los canales y el seguimiento post-masaje.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value={8}>8 semanas</option>
            <option value={12}>12 semanas</option>
            <option value={26}>26 semanas</option>
            <option value={52}>52 semanas</option>
          </select>
          <Button onClick={cargar} variant="outline" size="sm" disabled={cargando}>
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : cargando && !campanas ? (
        <div className="flex justify-center py-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* Cinta de KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              label="$ atribuido a campañas"
              value={clp(campanas?.resumen.ingreso_atribuido)}
              sub={`${campanas?.resumen.reservaron ?? 0} reservas (30 d)`}
            />
            <Kpi
              label="ROI neto campañas"
              value={campanas?.resumen.roi_neto != null ? clp(campanas.resumen.roi_neto) : '—'}
              sub={
                campanas?.resumen.roas != null
                  ? `ROAS ${campanas.resumen.roas.toFixed(1)}×`
                  : 'configura la tarifa'
              }
            />
            <Kpi
              label="Borradores sin editar"
              value={`${agente?.resumen.pct_sin_editar ?? 0}%`}
              sub={
                agente?.resumen.delta_pts_8sem != null
                  ? `${agente.resumen.delta_pts_8sem >= 0 ? '+' : ''}${agente.resumen.delta_pts_8sem} pts (8 sem)`
                  : undefined
              }
            />
            <Kpi
              label="1ª respuesta (mediana)"
              value={`${canales?.resumen.primera_respuesta_mediana_min ?? 0} min`}
              sub={`backlog hoy: ${canales?.resumen.backlog_actual ?? 0}`}
            />
          </div>

          {/* Campañas: funnel + ROI */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">Campañas (Envíos por aprobar) — funnel y ROI</CardTitle>
                {campanas && campanas.series.length > 0 && (
                  <select
                    value={semana}
                    onChange={(e) => setSemana(e.target.value)}
                    className="flex-shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Todo el período</option>
                    {[...campanas.series].reverse().map((s) => (
                      <option key={s.semana} value={s.semana}>
                        {s.semana}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <CardDescription className="text-xs">
                {campanas?.tarifa_plantilla_clp == null
                  ? '⚠️ Configura la tarifa de plantilla en el admin para ver costo y ROI'
                  : `Tarifa por plantilla: ${clp(campanas.tarifa_plantilla_clp)} · costo ${clp(
                      semSel ? semSel.costo : campanas.resumen.costo_estimado
                    )} · ingreso ${clp(ingresoScope)}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {stages.map((s) => (
                  <div key={s.l} className="flex items-center gap-3 text-sm">
                    <span className="w-28 flex-shrink-0 text-slate-500">{s.l}</span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                      <div
                        style={{ width: `${Math.round(((s.v ?? 0) / fmax) * 100)}%`, background: s.c }}
                        className="h-full"
                      />
                    </div>
                    <span className="w-12 flex-shrink-0 text-right font-semibold">{s.v}</span>
                  </div>
                ))}
              </div>
              {campanas && campanas.series.length > 0 && (
                <Grafico>
                  <LineChart data={campanas.series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => clp(Number(v))} />
                    <Line type="monotone" dataKey="ingreso" name="Ingreso" stroke="#0F6E56" strokeWidth={2} dot={false} />
                    {campanas.tarifa_plantilla_clp != null && (
                      <Line type="monotone" dataKey="costo" name="Costo plantillas" stroke="#D85A30" strokeWidth={2} dot={false} />
                    )}
                  </LineChart>
                </Grafico>
              )}

              {/* Drill-down: reservas atribuidas (H-022) */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    Reservas atribuidas{semana ? ` · ${semana}` : ''}
                  </span>
                  <span className="text-xs text-slate-400">
                    {reservas.length} ·{' '}
                    {clp(reservas.reduce((a, r) => a + (r.total || 0), 0))}
                  </span>
                </div>
                {reservasErr ? (
                  <p className="text-xs text-slate-400">Detalle de reservas aún no disponible.</p>
                ) : reservas.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin reservas atribuidas en este período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-500">
                          <th className="py-1 pr-2 font-medium">Cliente</th>
                          <th className="py-1 pr-2 font-medium">N°</th>
                          <th className="py-1 pr-2 font-medium">Servicios</th>
                          <th className="py-1 pr-2 font-medium">Fecha</th>
                          <th className="py-1 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reservas.map((r) => (
                          <tr key={r.venta_id} className="border-b border-slate-100 align-top">
                            <td className="py-1.5 pr-2">{r.cliente_nombre || '—'}</td>
                            <td className="py-1.5 pr-2 font-mono text-slate-500">#{r.venta_id}</td>
                            <td className="py-1.5 pr-2">
                              {r.servicios.map((sv, i) => {
                                // "Descuento_Servicios" es un pseudo-servicio: la rebaja va
                                // en `cantidad` y `valor` es un centinela (-1). Lo mostramos
                                // como un descuento legible en vez de "×12000 · $-1".
                                const esDescuento = sv.valor < 0 || /descuento/i.test(sv.nombre);
                                return (
                                  <div key={i} className={esDescuento ? 'text-rose-600' : 'text-slate-600'}>
                                    {esDescuento
                                      ? `Descuento −${clp(sv.cantidad)}`
                                      : `${sv.nombre} ×${sv.cantidad} · ${clp(sv.valor)}`}
                                  </div>
                                );
                              })}
                            </td>
                            <td className="whitespace-nowrap py-1.5 pr-2 text-slate-600">{fechaCorta(r.fecha_reserva)}</td>
                            <td className="py-1.5 text-right font-semibold">{clp(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agente IA */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Agente IA — % de borradores enviados sin editar</CardTitle>
              <CardDescription className="text-xs">
                sube = el agente aprende y ahorra trabajo · {agente?.resumen.aprendizajes_aprobados ?? 0} aprendizajes ·
                ~{Math.round((agente?.resumen.tiempo_ahorrado_min_estim ?? 0) / 60)} h ahorradas (estim.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agente && (
                <Grafico>
                  <LineChart data={agente.series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Line type="monotone" dataKey="pct_sin_editar" name="% sin editar" stroke="#378ADD" strokeWidth={2} />
                    <Line type="monotone" dataKey="pct_escalado" name="% escalado" stroke="#BA7517" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                  </LineChart>
                </Grafico>
              )}
            </CardContent>
          </Card>

          {/* Canales */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Volumen por canal (conversaciones / semana)</CardTitle>
              <CardDescription className="text-xs">WhatsApp vs Instagram</CardDescription>
            </CardHeader>
            <CardContent>
              {canales && (
                <Grafico>
                  <LineChart data={canales.series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="whatsapp" name="WhatsApp" stroke="#059669" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="instagram" name="Instagram" stroke="#D4537E" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  </LineChart>
                </Grafico>
              )}
            </CardContent>
          </Card>

          {/* Conexión-Masajes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Conexión-Masajes — cobertura de seguimientos</CardTitle>
              <CardDescription className="text-xs">
                cobertura {masajes?.resumen.cobertura_pct ?? 0}% · tasa de respuesta:{' '}
                {masajes?.resumen.tasa_respuesta_pct == null ? 'no disponible' : `${masajes.resumen.tasa_respuesta_pct}%`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {masajes && (
                <Grafico>
                  <LineChart data={masajes.series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Line type="monotone" dataKey="cobertura_pct" name="Cobertura" stroke="#0d9488" strokeWidth={2} />
                  </LineChart>
                </Grafico>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
