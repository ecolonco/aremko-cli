'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  RefreshCw,
  Send,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import {
  fetchConversacionWhatsApp,
  responderWhatsApp,
  telefonoE164,
} from './api';
import type { MensajeWhatsApp } from './types';

interface ConversacionWhatsAppProps {
  /** Teléfono del cliente en cualquier formato; se normaliza a E.164 internamente. */
  telefono: string;
  nombre: string;
  disabled?: boolean;
}

const horaCorta = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Última vez que el cliente nos escribió (mensaje entrante más reciente).
const ultimoEntrante = (msgs: MensajeWhatsApp[]): MensajeWhatsApp | undefined =>
  [...msgs].reverse().find((m) => m.direction === 'in');

// La ventana de servicio de WhatsApp es de 24h desde el último mensaje del
// cliente. Fuera de ella sólo se puede enviar una plantilla aprobada.
const dentroVentana24h = (msgs: MensajeWhatsApp[]): boolean => {
  const ult = ultimoEntrante(msgs);
  if (!ult) return false;
  const t = new Date(ult.timestamp).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 24 * 60 * 60 * 1000;
};

export function ConversacionWhatsApp({
  telefono,
  nombre,
  disabled,
}: ConversacionWhatsAppProps) {
  const phone = telefonoE164(telefono);
  const [mensajes, setMensajes] = useState<MensajeWhatsApp[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviarError, setEnviarError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement | null>(null);

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!phone) {
        setError('Sin teléfono válido para este cliente');
        setCargando(false);
        return;
      }
      if (!silencioso) setCargando(true);
      try {
        const data = await fetchConversacionWhatsApp(phone);
        setMensajes(data.messages || []);
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error al cargar la conversación');
      } finally {
        setCargando(false);
      }
    },
    [phone]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Auto-scroll al último mensaje cuando cambia el hilo.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' });
  }, [mensajes.length]);

  const handleEnviar = async () => {
    const t = texto.trim();
    if (!t || enviando || disabled) return;
    setEnviando(true);
    setEnviarError(null);
    try {
      await responderWhatsApp(phone, t);
      setTexto('');
      // Recarga silenciosa para traer el saliente recién registrado en Django.
      await cargar(true);
    } catch (e: unknown) {
      setEnviarError(
        e instanceof Error ? e.message : 'No se pudo enviar el mensaje'
      );
    } finally {
      setEnviando(false);
    }
  };

  const ventanaAbierta = dentroVentana24h(mensajes);

  return (
    <section className="rounded-lg border border-emerald-200 bg-white">
      {/* Encabezado del hilo */}
      <div className="flex items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/60 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
          <MessageSquare className="h-3.5 w-3.5" />
          Conversación de WhatsApp
        </span>
        <button
          type="button"
          onClick={() => cargar()}
          disabled={cargando}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          title="Actualizar conversación"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Hilo de mensajes */}
      <div className="max-h-72 space-y-2 overflow-y-auto bg-slate-50 p-3">
        {cargando ? (
          <div className="flex items-center justify-center py-6 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : mensajes.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            Sin mensajes de WhatsApp registrados con {nombre.split(' ')[0]} todavía.
          </p>
        ) : (
          mensajes.map((m) => {
            const saliente = m.direction === 'out';
            return (
              <div
                key={m.wa_message_id}
                className={`flex ${saliente ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    saliente
                      ? 'rounded-br-sm bg-emerald-500 text-white'
                      : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      saliente ? 'text-emerald-100' : 'text-slate-400'
                    }`}
                  >
                    {horaCorta(m.timestamp)}
                    {saliente && m.status ? ` · ${m.status}` : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={finRef} />
      </div>

      {/* Caja de respuesta */}
      <div className="space-y-2 border-t border-slate-200 p-3">
        {!ventanaAbierta && mensajes.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Pasaron más de 24h desde el último mensaje del cliente. Meta sólo
              permite responder con una <strong>plantilla aprobada</strong> fuera
              de esa ventana; un mensaje libre será rechazado.
            </span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleEnviar();
              }
            }}
            disabled={disabled || enviando || !phone}
            rows={2}
            placeholder={`Responder a ${nombre.split(' ')[0]} por WhatsApp…`}
            className="w-full resize-y rounded-lg border border-slate-300 bg-white p-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
          />
          <Button
            onClick={handleEnviar}
            disabled={disabled || enviando || !texto.trim() || !phone}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-slate-400">
          Se envía desde el WhatsApp oficial de Aremko y queda guardado en la ficha.
          Atajo: ⌘/Ctrl + Enter.
        </p>
        {enviarError && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{enviarError}</span>
          </div>
        )}
      </div>
    </section>
  );
}
