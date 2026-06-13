'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  RefreshCw,
  Send,
  MessageSquare,
  AlertTriangle,
  FileText,
  Mic,
  Paperclip,
  Phone,
  Copy,
  Check,
} from 'lucide-react';
import {
  fetchConversacionWhatsApp,
  responderWhatsApp,
  enviarAdjuntoWhatsApp,
  telefonoE164,
} from './api';
import type { MensajeWhatsApp } from './types';

interface ConversacionWhatsAppProps {
  /** Teléfono del cliente en cualquier formato; se normaliza a E.164 internamente. */
  telefono: string;
  nombre: string;
  disabled?: boolean;
  /** Se llama tras enviar una respuesta con éxito (para refrescar listas externas). */
  onReplySent?: () => void;
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

// Renderiza el adjunto según su tipo (imagen, video, audio/voz, documento).
function MediaContenido({
  m,
  saliente,
}: {
  m: MensajeWhatsApp;
  saliente: boolean;
}) {
  const url = m.media_url || undefined;
  if (!url) return null;
  const mime = m.mime_type || '';

  if (m.type === 'image' || m.type === 'sticker' || mime.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={m.filename || 'imagen'}
          className="max-h-56 w-auto rounded-lg"
        />
      </a>
    );
  }
  if (m.type === 'video' || mime.startsWith('video/')) {
    return <video src={url} controls className="max-h-56 w-full rounded-lg" />;
  }
  if (
    m.type === 'audio' ||
    m.type === 'voice' ||
    mime.startsWith('audio/')
  ) {
    return (
      <div className="flex items-center gap-2">
        <Mic
          className={`h-4 w-4 flex-shrink-0 ${
            saliente ? 'text-emerald-100' : 'text-slate-400'
          }`}
        />
        <audio src={url} controls className="h-9 max-w-[220px]" />
      </div>
    );
  }
  // Documento u otros → enlace de descarga con el nombre original.
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
        saliente ? 'bg-emerald-600/40' : 'bg-slate-100'
      }`}
    >
      <FileText className="h-5 w-5 flex-shrink-0" />
      <span className="truncate text-xs underline">
        {m.filename || 'Documento'}
      </span>
    </a>
  );
}

export function ConversacionWhatsApp({
  telefono,
  nombre,
  disabled,
  onReplySent,
}: ConversacionWhatsAppProps) {
  const phone = telefonoE164(telefono);
  const [mensajes, setMensajes] = useState<MensajeWhatsApp[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviarError, setEnviarError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const finRef = useRef<HTMLDivElement | null>(null);

  const copiarTelefono = useCallback(() => {
    if (!phone) return;
    navigator.clipboard?.writeText(phone).then(
      () => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      },
      () => {}
    );
  }, [phone]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Auto-refresco del hilo abierto: los mensajes entrantes aparecen solos sin
  // tener que presionar "Actualizar". Silencioso para no parpadear el loader.
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  useEffect(() => {
    if (!phone) return;
    const id = setInterval(() => cargarRef.current(true), 12_000);
    return () => clearInterval(id);
  }, [phone]);

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
      onReplySent?.();
    } catch (e: unknown) {
      setEnviarError(
        e instanceof Error ? e.message : 'No se pudo enviar el mensaje'
      );
    } finally {
      setEnviando(false);
    }
  };

  const handleAdjuntar = async (file: File | undefined) => {
    if (!file || enviando || disabled) return;
    setEnviando(true);
    setEnviarError(null);
    try {
      // El texto que esté escrito viaja como caption del adjunto.
      await enviarAdjuntoWhatsApp(phone, file, texto.trim() || undefined);
      setTexto('');
      await cargar(true);
      onReplySent?.();
    } catch (e: unknown) {
      setEnviarError(e instanceof Error ? e.message : 'No se pudo enviar el adjunto');
    } finally {
      setEnviando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const ventanaAbierta = dentroVentana24h(mensajes);

  return (
    <section className="rounded-lg border border-emerald-200 bg-white">
      {/* Encabezado del hilo */}
      <div className="flex items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/60 px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            <MessageSquare className="h-3 w-3" />
            Conversación de WhatsApp
          </span>
          <span className="truncate text-sm font-semibold text-emerald-900">{nombre}</span>
          {phone && (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-700">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span className="font-mono">{phone}</span>
              <button
                type="button"
                onClick={copiarTelefono}
                title="Copiar número"
                className="inline-flex items-center rounded p-0.5 hover:bg-emerald-100"
              >
                {copiado ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
              <a
                href={`https://wa.me/${phone.replace('+', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir en WhatsApp"
                className="underline hover:text-emerald-900"
              >
                abrir
              </a>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => cargar()}
          disabled={cargando}
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
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
                  <div className="space-y-1.5">
                    <MediaContenido m={m} saliente={saliente} />
                    {m.body ? (
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    ) : !m.media_url ? (
                      <p className="whitespace-pre-wrap break-words italic opacity-70">
                        [{m.type}]
                      </p>
                    ) : null}
                  </div>
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
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,application/pdf"
            onChange={(e) => handleAdjuntar(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || enviando || !phone}
            title="Adjuntar foto, PDF, audio o video (máx 16 MB)"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envía; Shift+Enter hace salto de línea. isComposing evita
              // enviar al confirmar acentos/IME a mitad de palabra.
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
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
          Enter envía · Shift+Enter salto de línea · 📎 adjunta foto/PDF/audio/video.
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
