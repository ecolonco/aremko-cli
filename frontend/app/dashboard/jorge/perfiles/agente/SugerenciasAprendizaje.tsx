'use client';

// "El agente aprendió algo" (H-010 p2): lista de sugerencias de aprendizaje que
// el agente extrajo de las correcciones de Deborah, clasificadas y ruteadas a su
// destino (catálogo / Conocimiento). Un humano aprueba o descarta con un clic.

import { useCallback, useEffect, useState } from 'react';
import { Brain, Loader2, Check, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  fetchSugerenciasAprendizaje,
  aprobarSugerencia,
  descartarSugerencia,
} from '../bandeja/api';
import type { SugerenciaAprendizaje } from '../bandeja/types';

const TIPO: Record<string, { label: string; cls: string }> = {
  hecho_catalogo: { label: '💰 Catálogo', cls: 'bg-amber-100 text-amber-800' },
  regla: { label: '📜 Regla', cls: 'bg-violet-100 text-violet-800' },
  tono: { label: '🎨 Tono', cls: 'bg-slate-100 text-slate-700' },
};

export default function SugerenciasAprendizaje() {
  const [items, setItems] = useState<SugerenciaAprendizaje[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textos, setTextos] = useState<Record<number, string>>({});
  const [procesando, setProcesando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const s = await fetchSugerenciasAprendizaje();
      setItems(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las sugerencias');
      setItems([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const aprobar = async (s: SugerenciaAprendizaje) => {
    if (procesando) return;
    setProcesando(s.id);
    try {
      await aprobarSugerencia(s.id, textos[s.id] ?? s.texto_propuesto);
      await cargar();
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
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descartar');
    } finally {
      setProcesando(null);
    }
  };

  return (
    <div className="rounded-lg border border-violet-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-violet-600" />
        <h3 className="text-sm font-semibold text-gray-900">
          El agente aprendió algo{items && items.length > 0 ? ` (${items.length})` : ''}
        </h3>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        Correcciones que el agente detectó en las respuestas de Deborah. Apruébalas para que aprenda
        (las reglas entran al Conocimiento; los precios/catálogo quedan para que Jorge los actualice).
      </p>

      {items === null ? (
        <div className="flex justify-center py-6 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Sin sugerencias pendientes — el agente está al día.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((s) => {
            const t = TIPO[s.tipo] ?? { label: s.tipo, cls: 'bg-slate-100 text-slate-700' };
            const esCatalogo = s.tipo === 'hecho_catalogo';
            return (
              <li key={s.id} className="rounded-md border border-gray-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.cls}`}>
                    {t.label}
                  </span>
                  {s.destino && <span className="text-[11px] text-gray-500">{s.destino}</span>}
                  {s.aprueba && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                      {s.aprueba}
                    </span>
                  )}
                </div>

                {/* Contexto: qué corrigió Deborah */}
                <div className="mt-2 space-y-0.5 text-[11px] text-gray-400">
                  <div className="line-clamp-2">
                    <span className="text-gray-500">Borrador:</span> {s.borrador}
                  </div>
                  <div className="line-clamp-2">
                    <span className="text-gray-500">Deborah envió:</span> {s.enviado}
                  </div>
                </div>

                {/* Propuesta */}
                {esCatalogo ? (
                  <div className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    Actualiza en el catálogo: <strong>{s.ref_catalogo || s.texto_propuesto}</strong>
                  </div>
                ) : (
                  <textarea
                    value={textos[s.id] ?? s.texto_propuesto}
                    onChange={(e) => setTextos((m) => ({ ...m, [s.id]: e.target.value }))}
                    rows={2}
                    className="mt-2 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-violet-500 focus:ring-violet-500"
                  />
                )}

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => aprobar(s)}
                    disabled={procesando === s.id}
                    className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {procesando === s.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
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
