'use client';

// "El agente aprendió algo" (H-010 p2 + H-013): procesa las correcciones de
// Deborah (botón manual), las clasifica y las muestra como Pendientes (aprobar/
// descartar) e Historial (qué aprendió, dónde y cuándo). Cada ítem deja claro:
// Problema (qué corrigió) · Aprendizaje (regla/precio) · Dónde (Conocimiento/Catálogo).

import { useCallback, useEffect, useState } from 'react';
import { Brain, Loader2, Check, X, AlertTriangle, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import {
  fetchSugerenciasAprendizaje,
  aprobarSugerencia,
  descartarSugerencia,
  procesarAprendizaje,
} from '../bandeja/api';
import type { SugerenciaAprendizaje } from '../bandeja/types';

const TIPO: Record<string, { label: string; cls: string }> = {
  hecho_catalogo: { label: '💰 Catálogo', cls: 'bg-amber-100 text-amber-800' },
  regla: { label: '📜 Regla', cls: 'bg-violet-100 text-violet-800' },
  tono: { label: '🎨 Tono', cls: 'bg-slate-100 text-slate-700' },
};

const fecha = (s: string) => {
  try {
    return new Date(s).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return s;
  }
};

export default function SugerenciasAprendizaje() {
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes');
  const [items, setItems] = useState<SugerenciaAprendizaje[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textos, setTextos] = useState<Record<number, string>>({});
  const [procesando, setProcesando] = useState<number | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [resumen, setResumen] = useState<string | null>(null);

  const cargar = useCallback(async (t: 'pendientes' | 'historial') => {
    setItems(null);
    try {
      if (t === 'pendientes') {
        setItems(await fetchSugerenciasAprendizaje('pendiente'));
      } else {
        const [apr, des] = await Promise.all([
          fetchSugerenciasAprendizaje('aprobada'),
          fetchSugerenciasAprendizaje('descartada'),
        ]);
        setItems([...apr, ...des].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar');
      setItems([]);
    }
  }, []);

  useEffect(() => {
    cargar(tab);
  }, [tab, cargar]);

  const procesar = async () => {
    if (corriendo) return;
    setCorriendo(true);
    setResumen(null);
    setError(null);
    try {
      const r = await procesarAprendizaje();
      setResumen(`Procesados ${r.procesados} · ${r.creadas} sugerencia${r.creadas === 1 ? '' : 's'} nueva${r.creadas === 1 ? '' : 's'}`);
      setTab('pendientes');
      await cargar('pendientes');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar');
    } finally {
      setCorriendo(false);
    }
  };

  const aprobar = async (s: SugerenciaAprendizaje) => {
    if (procesando) return;
    setProcesando(s.id);
    try {
      await aprobarSugerencia(s.id, textos[s.id] ?? s.texto_propuesto);
      await cargar(tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aprobar');
    } finally {
      setProcesando(null);
    }
  };

  const descartar = async (s: SugerenciaAprendizaje) => {
    if (procesando) return;
    setProcesando(s.id);
    try {
      await descartarSugerencia(s.id);
      await cargar(tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descartar');
    } finally {
      setProcesando(null);
    }
  };

  const esHist = tab === 'historial';

  return (
    <div className="rounded-lg border border-violet-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-600" />
          <h3 className="text-sm font-semibold text-gray-900">El agente aprendió algo</h3>
        </div>
        <button
          type="button"
          onClick={procesar}
          disabled={corriendo}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          title="Clasifica las correcciones recientes de Deborah"
        >
          {corriendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {corriendo ? 'Procesando…' : 'Procesar aprendizaje'}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        Corrige al agente con las ediciones de Deborah: las reglas entran al Conocimiento; los
        precios/catálogo quedan para que Jorge los actualice.
      </p>
      {resumen && (
        <p className="mt-2 flex items-center gap-1 text-xs text-violet-700">
          <CheckCircle2 className="h-4 w-4" /> {resumen}
        </p>
      )}

      {/* Tabs */}
      <div className="mt-3 flex gap-1 border-b border-gray-200 text-xs">
        {(['pendientes', 'historial'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-1.5 font-medium ${
              tab === t ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'pendientes' ? 'Pendientes' : 'Historial'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => cargar(tab)}
          className="ml-auto inline-flex items-center gap-1 px-2 text-gray-400 hover:text-gray-600"
          title="Refrescar"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {items === null ? (
        <div className="flex justify-center py-6 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {esHist ? 'Aún no hay historial de aprendizaje.' : 'Sin sugerencias pendientes — el agente está al día.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((s) => {
            const t = TIPO[s.tipo] ?? { label: s.tipo, cls: 'bg-slate-100 text-slate-700' };
            const esCatalogo = s.tipo === 'hecho_catalogo';
            return (
              <li key={s.id} className="rounded-md border border-gray-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.cls}`}>{t.label}</span>
                  {s.aprueba && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{s.aprueba}</span>
                  )}
                  {esHist && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        s.estado === 'aprobada' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {s.estado === 'aprobada' ? '✓ aprobada' : '✗ descartada'}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-gray-400">{fecha(s.created_at)}</span>
                </div>

                {/* Problema */}
                <div className="mt-2 text-[11px] text-gray-500">
                  <span className="font-medium text-gray-600">Problema:</span> el agente dijo “{s.borrador}”;
                  Deborah corrigió a “{s.enviado}”.
                </div>

                {/* Aprendizaje + Dónde */}
                <div className="mt-1.5 text-xs">
                  <span className="font-medium text-gray-700">Aprendizaje:</span>{' '}
                  {esCatalogo ? (
                    <span className="text-amber-900">{s.ref_catalogo || s.texto_propuesto}</span>
                  ) : esHist ? (
                    <span className="text-gray-800">{s.texto_propuesto}</span>
                  ) : null}
                </div>
                {!esCatalogo && !esHist && (
                  <textarea
                    value={textos[s.id] ?? s.texto_propuesto}
                    onChange={(e) => setTextos((m) => ({ ...m, [s.id]: e.target.value }))}
                    rows={2}
                    className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-violet-500 focus:ring-violet-500"
                  />
                )}
                <div className="mt-1 text-[11px] text-gray-500">
                  <span className="font-medium text-gray-600">Dónde:</span> {s.destino || (esCatalogo ? 'Catálogo' : 'Conocimiento')}
                </div>

                {!esHist && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => aprobar(s)}
                      disabled={procesando === s.id}
                      className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {procesando === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      {esCatalogo ? 'Marcar aplicada' : 'Aprobar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => descartar(s)}
                      disabled={procesando === s.id}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Descartar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
