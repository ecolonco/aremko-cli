'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import {
  fetchMovimientos,
  fetchScriptsEstadisticas,
  type MovimientosResponse,
  type ScriptsEstadisticasResponse,
  type MatrixMovimientoCell,
} from '../bandeja/api';

// ============================================================================
// Helpers de fecha
// ============================================================================

const toISO = (d: Date) => d.toISOString().slice(0, 10);

const inicioDeMes = (): string => {
  const d = new Date();
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
};

const hoyISO = (): string => toISO(new Date());

const hace7Dias = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return toISO(d);
};

// Orden canónico para imprimir la matriz: de mejor a peor estado de valor.
const ORDEN_VALOR = [
  'Campeón',
  'Leal',
  'Gran Gastador Ocasional',
  'Regular',
  'En Prueba',
  'En Riesgo',
  'Dormido',
  'Perdido',
  'Pre-sistema',
];

const labelCorto = (v: string): string => {
  const map: Record<string, string> = {
    Campeón: 'Camp',
    Leal: 'Leal',
    'Gran Gastador Ocasional': 'GG Oc',
    Regular: 'Reg',
    'En Prueba': 'Pru',
    'En Riesgo': 'Rie',
    Dormido: 'Dor',
    Perdido: 'Per',
    'Pre-sistema': 'Pre',
  };
  return map[v] ?? v.slice(0, 3);
};

// ============================================================================
// Sub-componente: Tarjetas de totales (Movimientos)
// ============================================================================

function TotalesMovimientos({ data }: { data: MovimientosResponse }) {
  const { totales } = data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Positivos
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-emerald-600">
            <TrendingUp className="h-5 w-5" />
            +{totales.positivos.toLocaleString('es-CL')}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Negativos
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-red-600">
            <TrendingDown className="h-5 w-5" />
            -{totales.negativos.toLocaleString('es-CL')}
          </p>
        </CardContent>
      </Card>
      <Card
        className={
          totales.saldo_neto >= 0
            ? 'border-emerald-300 bg-emerald-50/40'
            : 'border-red-300 bg-red-50/40'
        }
      >
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Saldo Neto
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              totales.saldo_neto >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {totales.saldo_neto >= 0 ? '+' : ''}
            {totales.saldo_neto.toLocaleString('es-CL')}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Atribuidos a WhatsApp
          </p>
          <p className="mt-1 text-2xl font-semibold text-indigo-700">
            {totales.atribuidos_whatsapp.toLocaleString('es-CL')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Sub-componente: Matriz Origen → Destino
// ============================================================================

function MatrizValor({ celdas }: { celdas: MatrixMovimientoCell[] }) {
  // Pivot: filas = antes, columnas = despues, valores = cantidad
  // Solo incluir estados que aparezcan en data (para no mostrar matriz vacía 9×9).
  const presentes = useMemo(() => {
    const s = new Set<string>();
    celdas.forEach((c) => {
      s.add(c.antes);
      s.add(c.despues);
    });
    return ORDEN_VALOR.filter((v) => s.has(v));
  }, [celdas]);

  const pivot = useMemo(() => {
    const m: Record<string, Record<string, MatrixMovimientoCell | undefined>> = {};
    presentes.forEach((a) => {
      m[a] = {};
    });
    celdas.forEach((c) => {
      if (!m[c.antes]) m[c.antes] = {};
      m[c.antes][c.despues] = c;
    });
    return m;
  }, [celdas, presentes]);

  if (presentes.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No hubo movimientos de tramo en este período.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border-b border-slate-200 p-2 text-left font-medium text-slate-500">
              Origen ↓ / Destino →
            </th>
            {presentes.map((d) => (
              <th
                key={d}
                className="border-b border-slate-200 p-2 text-center font-medium text-slate-500"
                title={d}
              >
                {labelCorto(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {presentes.map((a) => (
            <tr key={a} className="border-b border-slate-100 last:border-0">
              <th className="p-2 text-left font-medium text-slate-700" title={a}>
                {labelCorto(a)}
              </th>
              {presentes.map((d) => {
                const cell = pivot[a]?.[d];
                const isDiagonal = a === d;
                if (isDiagonal) {
                  return (
                    <td
                      key={d}
                      className="p-2 text-center text-slate-300"
                    >
                      —
                    </td>
                  );
                }
                if (!cell || cell.cantidad === 0) {
                  return (
                    <td key={d} className="p-2 text-center text-slate-300">
                      ·
                    </td>
                  );
                }
                // Movimiento positivo si antes (índice mayor) → después (índice menor)
                // Es decir: bajar en el array ORDEN_VALOR = mejorar.
                const idxAntes = ORDEN_VALOR.indexOf(a);
                const idxDespues = ORDEN_VALOR.indexOf(d);
                const esPositivo = idxDespues < idxAntes;
                return (
                  <td
                    key={d}
                    className={`p-2 text-center text-xs font-medium ${
                      esPositivo
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-red-50 text-red-800'
                    }`}
                    title={`${cell.atribuidos_whatsapp} atribuidos a WhatsApp`}
                  >
                    {cell.cantidad}
                    {cell.atribuidos_whatsapp > 0 && (
                      <span className="ml-1 text-[10px] opacity-60">
                        ({cell.atribuidos_whatsapp})
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-500">
        Verde = mejora · Rojo = deterioro · ( ) = atribuidos a WhatsApp en últimos 30d
      </p>
    </div>
  );
}

// ============================================================================
// Sub-componente: Tabla de scripts (¿funcionó?)
// ============================================================================

type OrdenScripts = 'enviados' | 'tasa_respuesta' | 'tasa_conversion' | 'ingreso';

function TablaScripts({ data }: { data: ScriptsEstadisticasResponse }) {
  const [orden, setOrden] = useState<OrdenScripts>('tasa_conversion');

  const sorted = useMemo(() => {
    const copia = [...data.scripts];
    copia.sort((a, b) => {
      switch (orden) {
        case 'enviados':
          return b.enviados - a.enviados;
        case 'tasa_respuesta':
          return b.tasa_respuesta - a.tasa_respuesta;
        case 'tasa_conversion':
          return b.tasa_conversion - a.tasa_conversion;
        case 'ingreso':
          return b.ingreso_atribuido - a.ingreso_atribuido;
      }
    });
    return copia;
  }, [data.scripts, orden]);

  if (data.scripts.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Aún no hay envíos atribuidos a scripts en este período.
      </p>
    );
  }

  const HeaderBtn = ({
    field,
    children,
  }: {
    field: OrdenScripts;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={() => setOrden(field)}
      className={`text-xs font-medium ${
        orden === field ? 'text-slate-900 underline' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="p-2 text-left text-xs font-medium text-slate-500">
              Script
            </th>
            <th className="p-2 text-left text-xs font-medium text-slate-500">
              Nombre
            </th>
            <th className="p-2 text-right">
              <HeaderBtn field="enviados">Enviados</HeaderBtn>
            </th>
            <th className="p-2 text-right">
              <HeaderBtn field="tasa_respuesta">% Resp</HeaderBtn>
            </th>
            <th className="p-2 text-right text-xs font-medium text-slate-500">
              Reservaron
            </th>
            <th className="p-2 text-right">
              <HeaderBtn field="tasa_conversion">% Conv</HeaderBtn>
            </th>
            <th className="p-2 text-right">
              <HeaderBtn field="ingreso">Ingreso ($)</HeaderBtn>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.script_id} className="border-b border-slate-100 last:border-0">
              <td className="p-2 font-mono text-xs text-slate-700">
                {s.script_id}
              </td>
              <td className="p-2 text-xs text-slate-800">{s.nombre}</td>
              <td className="p-2 text-right tabular-nums">{s.enviados}</td>
              <td className="p-2 text-right tabular-nums text-slate-600">
                {s.enviados > 0 ? `${Math.round(s.tasa_respuesta * 100)}%` : '—'}
              </td>
              <td className="p-2 text-right tabular-nums">{s.reservaron}</td>
              <td className="p-2 text-right tabular-nums font-medium text-emerald-700">
                {s.enviados > 0
                  ? `${Math.round(s.tasa_conversion * 100)}%`
                  : '—'}
              </td>
              <td className="p-2 text-right tabular-nums">
                ${s.ingreso_atribuido.toLocaleString('es-CL')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-500">
        Click en cabecera para ordenar · % Conv = reservas en 30d post-envío
      </p>
    </div>
  );
}

// ============================================================================
// Página principal
// ============================================================================

export default function TablerosBandejaPage() {
  // Movimientos del mes en curso por default
  const [movDesde, setMovDesde] = useState(inicioDeMes());
  const [movHasta, setMovHasta] = useState(hoyISO());
  const [movimientos, setMovimientos] = useState<MovimientosResponse | null>(null);
  const [loadingMov, setLoadingMov] = useState(true);
  const [errorMov, setErrorMov] = useState<string | null>(null);

  // Scripts: última semana por default
  const [scrDesde, setScrDesde] = useState(hace7Dias());
  const [scrHasta, setScrHasta] = useState(hoyISO());
  const [scripts, setScripts] = useState<ScriptsEstadisticasResponse | null>(null);
  const [loadingScr, setLoadingScr] = useState(true);
  const [errorScr, setErrorScr] = useState<string | null>(null);

  const cargarMovimientos = useCallback(async () => {
    setLoadingMov(true);
    setErrorMov(null);
    try {
      const data = await fetchMovimientos(movDesde, movHasta);
      setMovimientos(data);
    } catch (e: unknown) {
      setErrorMov(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setLoadingMov(false);
    }
  }, [movDesde, movHasta]);

  const cargarScripts = useCallback(async () => {
    setLoadingScr(true);
    setErrorScr(null);
    try {
      const data = await fetchScriptsEstadisticas(scrDesde, scrHasta);
      setScripts(data);
    } catch (e: unknown) {
      setErrorScr(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setLoadingScr(false);
    }
  }, [scrDesde, scrHasta]);

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

  useEffect(() => {
    cargarScripts();
  }, [cargarScripts]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      {/* SECCIÓN 1: Movimientos del Mes */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Movimientos del Mes
              </CardTitle>
              <CardDescription>
                Cómo se mueven los clientes entre tramos del eje Valor.
                Saldo Neto = positivos − negativos. La métrica única del plan.
              </CardDescription>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex flex-col text-xs text-slate-600">
                Desde
                <input
                  type="date"
                  value={movDesde}
                  onChange={(e) => setMovDesde(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col text-xs text-slate-600">
                Hasta
                <input
                  type="date"
                  value={movHasta}
                  onChange={(e) => setMovHasta(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={cargarMovimientos}
                disabled={loadingMov}
              >
                {loadingMov ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Refrescar'
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingMov ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : errorMov ? (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              {errorMov}
            </div>
          ) : movimientos ? (
            <>
              <TotalesMovimientos data={movimientos} />
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-medium text-slate-700">
                  Matriz Origen → Destino (eje Valor)
                </h3>
                <MatrizValor celdas={movimientos.matriz_eje_valor} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* SECCIÓN 2: ¿Funcionó? — performance por script */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                ¿Funcionó? — Performance por Script
              </CardTitle>
              <CardDescription>
                Qué plantilla está convirtiendo mejor.
                Aquí vemos si vale la pena ajustar textos o cohortes.
              </CardDescription>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex flex-col text-xs text-slate-600">
                Desde
                <input
                  type="date"
                  value={scrDesde}
                  onChange={(e) => setScrDesde(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col text-xs text-slate-600">
                Hasta
                <input
                  type="date"
                  value={scrHasta}
                  onChange={(e) => setScrHasta(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={cargarScripts}
                disabled={loadingScr}
              >
                {loadingScr ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Refrescar'
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingScr ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : errorScr ? (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              {errorScr}
            </div>
          ) : scripts ? (
            <TablaScripts data={scripts} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
