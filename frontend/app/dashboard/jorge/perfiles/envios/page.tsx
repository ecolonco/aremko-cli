'use client';

// "Envíos por aprobar" (H-012): la Bandeja propone contactar clientes con
// plantillas aprobadas (reactivación, etc.). Deborah revisa, aprueba (individual
// o por lote) y envía. Reemplaza el envío manual que ya no es posible con Cloud API.

import { useCallback, useEffect, useState } from 'react';
import { Send, Loader2, Check, X, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  fetchBandejaEnvios,
  aprobarEnvio,
  descartarEnvio,
  aprobarLoteEnvios,
  enviarAprobados,
} from '../bandeja/api';
import type { EnvioPlantilla } from '../bandeja/types';

export default function EnviosPage() {
  const [items, setItems] = useState<EnvioPlantilla[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [loteMotivo, setLoteMotivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setItems(null);
    try {
      setItems(await fetchBandejaEnvios('por_aprobar'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar');
      setItems([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const grupos: Record<string, EnvioPlantilla[]> = {};
  (items ?? []).forEach((e) => {
    (grupos[e.motivo || 'Sin motivo'] ||= []).push(e);
  });

  const accion = async (fn: () => Promise<unknown>, id: number) => {
    if (procesando) return;
    setProcesando(id);
    try {
      await fn();
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar');
    } finally {
      setProcesando(null);
    }
  };

  const aprobarMotivo = async (motivo: string, ids: number[]) => {
    if (loteMotivo) return;
    setLoteMotivo(motivo);
    try {
      await aprobarLoteEnvios({ ids });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aprobar el lote');
    } finally {
      setLoteMotivo(null);
    }
  };

  const enviar = async () => {
    if (enviando) return;
    setEnviando(true);
    setResultado(null);
    setError(null);
    try {
      const r = await enviarAprobados();
      setResultado(`Enviados ${r.enviados}${r.fallidos ? ` · ${r.fallidos} fallidos` : ''} (de ${r.total} aprobados)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Send className="h-6 w-6 text-emerald-600" />
            Envíos por aprobar
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            El sistema propone contactar a estos clientes con una <strong>plantilla aprobada</strong>.
            Revisa, aprueba (individual o por motivo) y luego <strong>Enviar aprobados</strong>. Cuando
            el cliente responde, lo atiende el agente.
          </p>
        </div>
        <button
          onClick={enviar}
          disabled={enviando}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar aprobados
        </button>
      </div>

      {resultado && (
        <p className="mt-3 flex items-center gap-1 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {resultado}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        <button onClick={cargar} className="inline-flex items-center gap-1 hover:text-gray-600">
          <RefreshCw className="h-3.5 w-3.5" /> Refrescar
        </button>
      </div>

      {items === null ? (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          No hay envíos por aprobar. Aparecen cuando el sistema detecta clientes a contactar
          <strong> y su mensaje tiene una plantilla aprobada mapeada</strong>.
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {Object.entries(grupos).map(([motivo, envios]) => (
            <div key={motivo}>
              <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                <h2 className="text-sm font-semibold text-gray-800">
                  📨 {motivo} <span className="text-gray-400">({envios.length})</span>
                </h2>
                <button
                  onClick={() => aprobarMotivo(motivo, envios.map((e) => e.contacto_id))}
                  disabled={loteMotivo === motivo}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {loteMotivo === motivo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Aprobar todos
                </button>
              </div>
              <ul className="mt-2 space-y-2">
                {envios.map((e) => (
                  <li key={e.contacto_id} className="rounded-md border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{e.cliente_nombre || e.phone}</span>
                      <span className="font-mono text-[11px] text-gray-400">{e.phone}</span>
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">{e.plantilla}</span>
                      {e.prioridad != null && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">P{e.prioridad}</span>
                      )}
                      {e.fecha_sugerido && <span className="ml-auto text-[10px] text-gray-400">{e.fecha_sugerido}</span>}
                    </div>
                    <div className="mt-2 whitespace-pre-line rounded bg-emerald-50 px-2 py-1.5 text-xs text-gray-800">
                      {e.preview}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => accion(() => aprobarEnvio(e.contacto_id), e.contacto_id)}
                        disabled={procesando === e.contacto_id}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {procesando === e.contacto_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Aprobar
                      </button>
                      <button
                        onClick={() => accion(() => descartarEnvio(e.contacto_id), e.contacto_id)}
                        disabled={procesando === e.contacto_id}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Descartar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-1 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> {error}
        </p>
      )}
    </div>
  );
}
