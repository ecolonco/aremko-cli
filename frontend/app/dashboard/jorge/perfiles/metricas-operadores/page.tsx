'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  AlertCircle,
  MessageSquare,
  Reply,
  Trophy,
  DollarSign,
  Calendar,
  RefreshCw,
  Award,
} from 'lucide-react';
import {
  fetchMetricasOperadores,
} from '../bandeja/api';
import type {
  MetricasOperadoresResponse,
  OperadorMetricas,
} from '../bandeja/types';

const toISO = (d: Date) => d.toISOString().slice(0, 10);
const hoyISO = (): string => toISO(new Date());
const hace30Dias = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toISO(d);
};

const formatCLP = (n: number): string =>
  '$' + (n || 0).toLocaleString('es-CL');

const formatPct = (n: number): string =>
  ((n || 0) * 100).toFixed(1) + '%';

// Operadores conocidos del sistema (forzar aparición con ceros)
const OPERADORES_ESPERADOS = 'deborah,jorge,angelica';

// ============================================================================
// Cards de totales
// ============================================================================

function TotalesCards({ data }: { data: MetricasOperadoresResponse }) {
  const { totales } = data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Mensajes enviados
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-800">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            {totales.mensajes_enviados.toLocaleString('es-CL')}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Respuestas
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-blue-600">
            <Reply className="h-5 w-5" />
            {totales.respuestas.toLocaleString('es-CL')}
            <span className="text-sm font-normal text-slate-500">
              ({formatPct(totales.tasa_respuesta)})
            </span>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Reservas atribuidas
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-emerald-600">
            <Trophy className="h-5 w-5" />
            {totales.reservas_atribuidas.toLocaleString('es-CL')}
            <span className="text-sm font-normal text-slate-500">
              ({formatPct(totales.tasa_conversion)})
            </span>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Monto atribuido
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-emerald-700">
            <DollarSign className="h-5 w-5" />
            {formatCLP(totales.monto_atribuido)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Ticket promedio: {formatCLP(totales.ticket_promedio_atribuido)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Fila de la tabla ranking
// ============================================================================

function FilaOperador({
  op,
  rank,
  topMonto,
}: {
  op: OperadorMetricas;
  rank: number;
  topMonto: number;
}) {
  // Barra visual proporcional al monto (vs top operador)
  const pctBar = topMonto > 0 ? (op.monto_atribuido / topMonto) * 100 : 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={
                rank === 1
                  ? 'flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700'
                  : rank === 2
                  ? 'flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700'
                  : rank === 3
                  ? 'flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700'
                  : 'flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500'
              }
            >
              {rank}
            </span>
            <span className="text-base font-semibold capitalize text-slate-800">
              {op.username}
            </span>
          </div>
          <div className="ml-auto text-right">
            <p className="text-lg font-semibold text-emerald-700">
              {formatCLP(op.monto_atribuido)}
            </p>
            <p className="text-[11px] text-slate-500">
              {op.reservas_atribuidas} reserva
              {op.reservas_atribuidas === 1 ? '' : 's'} · ticket{' '}
              {formatCLP(op.ticket_promedio_atribuido)}
            </p>
          </div>
        </div>

        {/* Barra proporcional al top */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${pctBar}%` }}
          />
        </div>

        {/* Stats secundarias */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-slate-500">Enviados</p>
            <p className="font-medium text-slate-800">
              {op.mensajes_enviados.toLocaleString('es-CL')}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Tasa respuesta</p>
            <p className="font-medium text-blue-600">
              {formatPct(op.tasa_respuesta)}{' '}
              <span className="font-normal text-slate-400">
                ({op.respuestas})
              </span>
            </p>
          </div>
          <div>
            <p className="text-slate-500">Conversión</p>
            <p className="font-medium text-emerald-600">
              {formatPct(op.tasa_conversion)}
            </p>
          </div>
        </div>

        {/* Familias top */}
        {op.familias_top.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
              <Award className="h-3 w-3" /> Familias top vendidas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {op.familias_top.map((f) => (
                <span
                  key={f.familia}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700"
                >
                  <strong>{f.familia}</strong>
                  <span className="text-emerald-600">
                    · {f.reservas} · {formatCLP(f.monto)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Página principal
// ============================================================================

export default function MetricasOperadoresPage() {
  const [desde, setDesde] = useState<string>(hace30Dias());
  const [hasta, setHasta] = useState<string>(hoyISO());
  const [ventana, setVentana] = useState<number>(60);

  const [data, setData] = useState<MetricasOperadoresResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMetricasOperadores({
        desde,
        hasta,
        ventana_atribucion_dias: ventana,
        operadores_esperados: OPERADORES_ESPERADOS,
      });
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, ventana]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const operadoresOrdenados = data
    ? [...data.operadores].sort((a, b) => b.monto_atribuido - a.monto_atribuido)
    : [];
  const topMonto = operadoresOrdenados[0]?.monto_atribuido ?? 0;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header con filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-600" />
            Métricas por operador
          </CardTitle>
          <CardDescription>
            Atribución <strong>last-touch</strong> · ventana {ventana} días ·
            solo reservas confirmadas (con abono o pago)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Desde
              </label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Hasta
              </label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Ventana atribución (días)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={ventana}
                onChange={(e) => setVentana(Number(e.target.value) || 60)}
                className="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <Button
              onClick={cargar}
              disabled={loading}
              size="sm"
              variant="outline"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-1">Refrescar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando métricas…
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 p-4 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Data */}
      {data && (
        <>
          <TotalesCards data={data} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-slate-500" />
                Ranking operadores —{' '}
                <span className="font-normal text-slate-500">
                  {data.periodo.desde} → {data.periodo.hasta}
                </span>
              </CardTitle>
            </CardHeader>
          </Card>

          {operadoresOrdenados.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-slate-500">
                Sin actividad en el periodo.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {operadoresOrdenados.map((op, i) => (
                <FilaOperador
                  key={op.username}
                  op={op}
                  rank={i + 1}
                  topMonto={topMonto}
                />
              ))}
            </div>
          )}

          {/* Nota explicativa */}
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="p-3 text-[11px] leading-relaxed text-slate-600">
              <strong>Cómo se calcula:</strong> Para cada reserva confirmada
              del periodo, se busca el último operador que envió un mensaje al
              cliente dentro de los {ventana} días anteriores. Se le atribuye
              ese mensaje y el monto de la reserva. Una reserva sin envío en
              ventana no se cuenta. Una reserva con varios envíos solo se
              atribuye al último operador (last-touch).
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
