'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera as Instagram, Loader2, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchConversacionInbox, marcarAtendidoInbox } from './api';
import type { MensajeInbox } from './types';

interface Props {
  externalId: string; // IGSID del cliente
  nombre: string;
  onVolver?: () => void;
  onAtendido?: () => void;
}

const POLL_MS = 30_000;

const hora = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
};

// Conversación de Instagram en SOLO LECTURA. Responder por IG llega en H-017
// (necesita el token de envío). Por ahora se ve el hilo y se marca como leído.
export function ConversacionInstagram({ externalId, nombre, onVolver, onAtendido }: Props) {
  const [mensajes, setMensajes] = useState<MensajeInbox[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true);
      try {
        const data = await fetchConversacionInbox('instagram', externalId);
        setMensajes(data.messages || []);
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error al cargar la conversación');
      } finally {
        setCargando(false);
      }
    },
    [externalId]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Auto-refresco del hilo (sin parpadear la pantalla).
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  useEffect(() => {
    const id = setInterval(() => cargarRef.current(true), POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [mensajes]);

  const atender = async () => {
    try {
      await marcarAtendidoInbox('instagram', externalId);
      onAtendido?.();
    } catch {
      /* no bloquea la vista */
    }
  };

  return (
    <section className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg border border-pink-200 bg-white">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-pink-100 bg-pink-50/60 p-3">
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            aria-label="Volver a la lista"
            className="md:hidden -ml-1 rounded-md p-1.5 text-slate-600 hover:bg-pink-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-pink-600">
            <Instagram className="h-3 w-3" />
            Conversación de Instagram
          </span>
          <p className="truncate text-sm font-medium text-slate-900">{nombre}</p>
        </div>
        <Button onClick={() => cargar()} variant="outline" size="sm" disabled={cargando}>
          <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
        </Button>
        <Button onClick={atender} variant="outline" size="sm">
          <Check className="mr-0 h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Leído</span>
        </Button>
      </header>

      <div className="min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : cargando ? (
          <div className="flex justify-center py-6 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : mensajes.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">Sin mensajes en esta conversación.</p>
        ) : (
          mensajes.map((m) => (
            <div
              key={m.external_message_id}
              className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.direction === 'out'
                    ? 'bg-pink-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-800'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">
                  {m.body || (m.type !== 'text' ? `[${m.type}]` : '')}
                </p>
                <span
                  className={`mt-0.5 block text-right text-[10px] ${
                    m.direction === 'out' ? 'text-pink-100' : 'text-slate-400'
                  }`}
                >
                  {hora(m.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={finRef} />
      </div>

      <div className="flex-shrink-0 border-t border-slate-200 bg-pink-50/40 p-3 text-center text-xs text-slate-500">
        ✍️ Responder por Instagram llega pronto. Por ahora podés ver el hilo y marcarlo como leído.
      </div>
    </section>
  );
}
