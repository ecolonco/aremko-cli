'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { ConversacionWhatsApp } from '../bandeja/ConversacionWhatsApp';
import {
  telefonoE164,
  fetchConversacionesWhatsApp,
} from '../bandeja/api';
import type { ConversacionResumen } from '../bandeja/types';

// Número piloto de Meta (sandbox) con el que validamos el end-to-end.
const PILOTO = '+56958655810';
const POLL_MS = 30_000;

const horaCorta = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
};

export default function MensajesWhatsAppPage() {
  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [activo, setActivo] = useState<string>('');
  const [input, setInput] = useState('');

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true);
      try {
        const data = await fetchConversacionesWhatsApp(soloPendientes, 100);
        setConversaciones(data.conversations || []);
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error al cargar conversaciones');
      } finally {
        setCargando(false);
      }
    },
    [soloPendientes]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Auto-refresco de la lista (bandeja de entrada en vivo).
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  useEffect(() => {
    const id = setInterval(() => cargarRef.current(true), POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Abre el primer hilo automáticamente cuando llega la lista y no hay activo.
  useEffect(() => {
    if (!activo && conversaciones.length > 0) {
      setActivo(conversaciones[0].phone);
    }
  }, [conversaciones, activo]);

  const abrirNumero = (raw: string) => {
    const phone = telefonoE164(raw);
    if (!phone) return;
    setActivo(phone);
    setInput('');
  };

  const nombreActivo =
    conversaciones.find((c) => c.phone === activo)?.cliente_nombre || activo;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <MessageSquare className="h-7 w-7 text-emerald-600" />
            Mensajes WhatsApp
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conversaciones que entran y salen por la <strong>Cloud API oficial</strong> de
            Aremko. Lo que respondas acá se envía desde el WhatsApp del negocio y queda
            guardado en la ficha del cliente.
          </p>
        </div>
        <Button onClick={() => cargar()} variant="outline" size="sm" disabled={cargando}>
          <RefreshCw className={`mr-2 h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
          Refrescar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        {/* Columna izquierda: bandeja de entrada */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Conversaciones</CardTitle>
            <CardDescription className="text-xs">
              {cargando
                ? 'Cargando…'
                : `${conversaciones.length} ${soloPendientes ? 'pendientes' : 'en total'}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Buscador para abrir cualquier número */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                abrirNumero(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Abrir por teléfono…"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Button type="submit" size="sm" disabled={!input.trim()}>
                <Search className="h-4 w-4" />
              </Button>
            </form>

            {/* Filtro solo pendientes */}
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={soloPendientes}
                onChange={(e) => setSoloPendientes(e.target.checked)}
                className="rounded border-slate-300"
              />
              Solo las que esperan respuesta
            </label>

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : cargando ? (
              <div className="flex justify-center py-6 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : conversaciones.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                {soloPendientes
                  ? 'No hay conversaciones pendientes de respuesta.'
                  : 'Aún no hay conversaciones registradas.'}
              </p>
            ) : (
              <ul className="-mx-2 max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
                {conversaciones.map((c) => {
                  const sel = c.phone === activo;
                  return (
                    <li key={c.phone}>
                      <button
                        type="button"
                        onClick={() => setActivo(c.phone)}
                        className={`flex w-full flex-col gap-0.5 px-2 py-2 text-left transition ${
                          sel ? 'bg-emerald-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate text-sm ${
                              c.sin_responder > 0
                                ? 'font-semibold text-slate-900'
                                : 'font-medium text-slate-700'
                            }`}
                          >
                            {c.cliente_nombre || c.phone}
                          </span>
                          <span className="flex-shrink-0 text-[10px] text-slate-400">
                            {horaCorta(c.ultimo_timestamp)}
                          </span>
                        </div>
                        {c.cliente_nombre && (
                          <span className="truncate font-mono text-[10px] text-slate-400">
                            {c.phone}
                          </span>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-slate-500">
                            {c.ultimo_direction === 'out' ? 'Tú: ' : ''}
                            {c.ultimo_mensaje}
                          </span>
                          {c.sin_responder > 0 && (
                            <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                              {c.sin_responder}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Columna derecha: hilo + responder */}
        <div>
          {activo ? (
            <ConversacionWhatsApp
              key={activo}
              telefono={activo}
              nombre={nombreActivo}
              onReplySent={() => cargar(true)}
              onNombreEditado={() => cargar(true)}
              onAtendido={() => cargar(true)}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-sm text-slate-400">
                Elige una conversación o ábrela por teléfono.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
