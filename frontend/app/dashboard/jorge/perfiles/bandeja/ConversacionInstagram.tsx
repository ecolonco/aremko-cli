'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera as Instagram, MessageCircle, Loader2, RefreshCw, Check, AlertTriangle, Send, Sparkles, FileText, Mic, Paperclip, Images, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchConversacionInbox, marcarAtendidoInbox, responderInstagram, responderMessenger, enviarAdjuntoMeta, enviarAdjuntoURL } from './api';
import { BibliotecaMedios } from './BibliotecaMedios';
import type { CanalMensaje, MensajeInbox, SugerenciaAgente, PropuestaReserva, ReservaCreada, CarritoEnCurso } from './types';
import { CotizacionCajon } from './CotizacionCajon';
import { useAlternativasHorario } from './useAlternativasHorario';

interface Props {
  externalId: string; // IGSID (Instagram) o PSID (Messenger) del cliente
  nombre: string;
  canal?: CanalMensaje; // 'instagram' (default) | 'messenger'
  onVolver?: () => void;
  onAtendido?: () => void;
  onReplySent?: () => void;
}

const POLL_MS = 30_000;
// Meta solo permite responder por API dentro de las 24 h del último mensaje del
// cliente (Instagram y Messenger). Fuera de eso el envío falla (subcódigo 2534022).
const VENTANA_MS = 24 * 60 * 60 * 1000;

const hora = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
};

// Render del adjunto de un mensaje (H-020), espejo del de WhatsApp.
function MediaIG({ m, saliente }: { m: MensajeInbox; saliente: boolean }) {
  const url = m.media_url || undefined;
  if (!url) return null;
  const mime = m.mime_type || '';
  const tipo = m.type || '';
  if (
    tipo === 'image' ||
    tipo === 'sticker' ||
    tipo === 'story_mention' ||
    tipo === 'share' ||
    mime.startsWith('image/')
  ) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={m.filename || 'imagen'} className="max-h-56 w-auto rounded-lg" />
      </a>
    );
  }
  if (tipo === 'video' || mime.startsWith('video/')) {
    return <video src={url} controls className="max-h-56 w-full rounded-lg" />;
  }
  if (tipo === 'audio' || tipo === 'voice' || mime.startsWith('audio/')) {
    return (
      <div className="flex items-center gap-2">
        <Mic className={`h-4 w-4 flex-shrink-0 ${saliente ? 'text-pink-100' : 'text-slate-400'}`} />
        <audio src={url} controls className="h-9 max-w-[220px]" />
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
        saliente ? 'bg-pink-600/40' : 'bg-slate-100'
      }`}
    >
      <FileText className="h-5 w-5 flex-shrink-0" />
      <span className="truncate text-xs underline">{m.filename || 'Documento'}</span>
    </a>
  );
}

// Conversación de un canal Meta en la bandeja (Instagram o Messenger).
// Instagram: responder + borrador IA (H-017/H-019). Messenger: solo lectura
// por ahora (responder llega en una fase posterior, necesita el Page token).
export function ConversacionInstagram({ externalId, nombre, canal = 'instagram', onVolver, onAtendido, onReplySent }: Props) {
  const esIG = canal === 'instagram';
  // Tema visual por canal: Instagram rosado, Messenger azul.
  const tema = esIG
    ? { nombre: 'Instagram', Icono: Instagram, label: 'Conversación de Instagram', card: 'border-pink-200', hBorder: 'border-pink-100', hBg: 'bg-pink-50/60', hHover: 'hover:bg-pink-100', accent: 'text-pink-600', outBg: 'bg-pink-500', outTs: 'text-pink-100', focus: 'focus:border-pink-500 focus:ring-pink-500', sendBg: 'bg-pink-500 hover:bg-pink-600', dmUrl: 'https://www.instagram.com/direct/inbox/' }
    : { nombre: 'Messenger', Icono: MessageCircle, label: 'Conversación de Messenger', card: 'border-blue-200', hBorder: 'border-blue-100', hBg: 'bg-blue-50/60', hHover: 'hover:bg-blue-100', accent: 'text-blue-600', outBg: 'bg-blue-600', outTs: 'text-blue-100', focus: 'focus:border-blue-500 focus:ring-blue-500', sendBg: 'bg-blue-600 hover:bg-blue-700', dmUrl: 'https://www.messenger.com/' };
  const [mensajes, setMensajes] = useState<MensajeInbox[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sugerencia, setSugerencia] = useState<SugerenciaAgente | null>(null);
  const [propuesta, setPropuesta] = useState<PropuestaReserva | null>(null);
  const [reservaCreada, setReservaCreada] = useState<ReservaCreada | null>(null);
  const [carrito, setCarrito] = useState<CarritoEnCurso | null>(null); // H-046
  const [biblioteca, setBiblioteca] = useState(false);
  // Meta rechazó un envío por la ventana de 24h (subcódigo 2534022): bloquea el
  // cajón hasta que se recargue el hilo (y aparezca, o no, un nuevo entrante).
  const [ventanaMetaCerrada, setVentanaMetaCerrada] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Ventana de 24h (H-016): se cuenta desde el último mensaje ENTRANTE del
  // cliente. Fuera de ella Meta rechaza el envío, así que bloqueamos el cajón y
  // guiamos a responder desde la app. Se recalcula en cada render; el auto-refresco
  // (cada POLL_MS) la mantiene al día sin un temporizador aparte.
  let ultimoEntranteTs = 0;
  for (const m of mensajes) {
    if (m.direction === 'in') {
      const t = Date.parse(m.timestamp);
      if (!Number.isNaN(t) && t > ultimoEntranteTs) ultimoEntranteTs = t;
    }
  }
  const sinEntrante = ultimoEntranteTs === 0;
  const restanteMs = sinEntrante ? 0 : VENTANA_MS - (Date.now() - ultimoEntranteTs);
  const ventanaAbierta = !sinEntrante && restanteMs > 0;
  const bloqueado = !ventanaAbierta || ventanaMetaCerrada;
  const restanteHoras = Math.max(0, Math.floor(restanteMs / 3_600_000));
  const porCerrar = ventanaAbierta && !ventanaMetaCerrada && restanteMs < 3_600_000;

  // Traduce el error crudo de Meta. La ventana cerrada se detecta por el subcódigo
  // 2534022, NO por el texto: Meta lo devuelve localizado (a veces en árabe).
  const traducirError = (e: unknown, fallback: string): string => {
    const raw = e instanceof Error ? e.message : '';
    if (raw.includes('2534022')) {
      return `La ventana de 24 h se cerró. Respóndele a ${nombre} desde la app de ${tema.nombre} en el teléfono.`;
    }
    return raw || fallback;
  };
  const manejarErrorEnvio = (e: unknown, fallback: string) => {
    if (e instanceof Error && e.message.includes('2534022')) setVentanaMetaCerrada(true);
    setSendError(traducirError(e, fallback));
  };

  // Alternativas de horario (H-061) — mismo feature que WhatsApp, vía el hook
  // compartido. Deshabilitado si la ventana de 24h está cerrada o mientras envía.
  const alt = useAlternativasHorario({
    onUsarTexto: setInput,
    disabled: bloqueado || enviando,
    resetKey: externalId,
    btnClass:
      'flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-50',
    ringClass: tema.focus,
    buscarBtnClass: tema.sendBg,
    accentText: tema.accent,
  });

  const cargar = useCallback(
    // conSugerencia: pide el borrador del agente IA (H-019). Solo en la carga
    // inicial / "Actualizar", NO en el auto-refresco (para no gastar LLM).
    async (silencioso = false, conSugerencia = false) => {
      if (!silencioso) {
        setCargando(true);
        setVentanaMetaCerrada(false); // recarga manual: reevaluamos la ventana desde cero
      }
      try {
        const data = await fetchConversacionInbox(canal, externalId, 200, conSugerencia);
        setMensajes(data.messages || []);
        setPropuesta(data.propuesta_reserva ?? null); // H-028: propuesta pendiente de aprobar
        setReservaCreada(data.reserva_creada ?? null); // H-039: reserva creada por el Aprobar del cliente
        setCarrito(data.carrito_en_curso ?? null); // H-046: carrito en vivo (antes de cotizar)
        if (conSugerencia && data.sugerencia_agente) {
          setSugerencia(data.sugerencia_agente);
          const s = data.sugerencia_agente;
          // Precarga el cajón con el borrador (sin pisar lo que ya escribiste).
          if (!s.escalar && s.texto) {
            setInput((prev) => (prev.trim() ? prev : s.texto));
          }
        }
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error al cargar la conversación');
      } finally {
        setCargando(false);
      }
    },
    [canal, externalId]
  );

  useEffect(() => {
    cargar(false, true); // carga inicial: pide el borrador del agente (IG y Messenger)
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

  // Auto-alto del cajón: crece con el contenido (hasta un tope) para que el
  // borrador de IA, que suele ser largo, se vea completo sin scrollear.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  const atender = async () => {
    try {
      await marcarAtendidoInbox(canal, externalId);
      onAtendido?.();
    } catch {
      /* no bloquea la vista */
    }
  };

  const enviar = async () => {
    const text = input.trim();
    if (!text || enviando || bloqueado) return;
    setEnviando(true);
    setSendError(null);
    try {
      await (esIG ? responderInstagram : responderMessenger)(externalId, text);
      setInput('');
      // El saliente llega por el webhook "echo" de Meta; refrescamos en breve.
      setTimeout(() => cargarRef.current(true), 1500);
      onReplySent?.();
    } catch (e: unknown) {
      manejarErrorEnvio(e, 'No se pudo enviar el mensaje');
    } finally {
      setEnviando(false);
      // Devolver el foco al cajón para seguir escribiendo sin tocar el mouse.
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const adjuntar = async (file: File | undefined) => {
    if (!file || enviando || bloqueado) return;
    setEnviando(true);
    setSendError(null);
    try {
      // El texto escrito viaja como mensaje aparte (Meta no permite texto+adjunto juntos).
      await enviarAdjuntoMeta(canal as 'instagram' | 'messenger', externalId, file, input.trim() || undefined);
      setInput('');
      setTimeout(() => cargarRef.current(true), 1500);
      onReplySent?.();
    } catch (e: unknown) {
      manejarErrorEnvio(e, 'No se pudo enviar el adjunto');
    } finally {
      setEnviando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  // Enviar una foto/video elegido de la biblioteca del catálogo (por URL).
  const enviarDesdeBiblioteca = async (url: string) => {
    setBiblioteca(false);
    if (bloqueado) return;
    setEnviando(true);
    setSendError(null);
    try {
      await enviarAdjuntoURL(canal as 'instagram' | 'messenger', externalId, url, input.trim() || undefined);
      setInput('');
      setTimeout(() => cargarRef.current(true), 1500);
      onReplySent?.();
    } catch (e: unknown) {
      manejarErrorEnvio(e, 'No se pudo enviar la foto de la biblioteca');
    } finally {
      setEnviando(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  return (
    <section className={`relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg border ${tema.card} bg-white`}>
      {biblioteca && (
        <BibliotecaMedios
          accent={tema.accent}
          onClose={() => setBiblioteca(false)}
          onSelect={(url) => enviarDesdeBiblioteca(url)}
        />
      )}
      {alt.modal}
      <header className={`flex flex-shrink-0 items-center gap-2 border-b ${tema.hBorder} ${tema.hBg} p-3`}>
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            aria-label="Volver a la lista"
            className={`md:hidden -ml-1 rounded-md p-1.5 text-slate-600 ${tema.hHover}`}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${tema.accent}`}>
            <tema.Icono className="h-3 w-3" />
            {tema.label}
          </span>
          <p className="truncate text-sm font-medium text-slate-900">{nombre}</p>
        </div>
        <Button onClick={() => cargar(false, true)} variant="outline" size="sm" disabled={cargando}>
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
                className={`max-w-[80%] space-y-1 rounded-lg px-3 py-2 text-sm ${
                  m.direction === 'out'
                    ? `${tema.outBg} text-white`
                    : 'border border-slate-200 bg-white text-slate-800'
                }`}
              >
                {m.media_url ? (
                  <>
                    <MediaIG m={m} saliente={m.direction === 'out'} />
                    {m.body && (
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    )}
                  </>
                ) : (
                  <p className="whitespace-pre-wrap break-words">
                    {m.body || (m.type !== 'text' ? `[${m.type}]` : '')}
                  </p>
                )}
                <span
                  className={`mt-0.5 block text-right text-[10px] ${
                    m.direction === 'out' ? tema.outTs : 'text-slate-400'
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

      <div className="flex-shrink-0 space-y-2 border-t border-slate-200 p-3">
        {(propuesta || reservaCreada || carrito) && (
          <CotizacionCajon
            propuesta={propuesta}
            reservaCreada={reservaCreada}
            carrito={carrito} // H-046: carrito en vivo (editable desde H-079)
            onUsarTexto={(texto) => setInput(texto)} // Deborah revisa y lo envía al cliente
            onRefrescar={() => cargar(true)} // H-042: tras editar/cerrar, releer la conversación
            editCanal={canal} // H-079: identidad para corregir el carrito en curso
            editExternalId={externalId}
          />
        )}
        {sendError && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{sendError}</span>
          </p>
        )}
        {bloqueado && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="space-y-1.5">
              <p className="font-semibold">Ventana de 24 h cerrada</p>
              <p>
                {sinEntrante
                  ? `Todavía no hay un mensaje de ${nombre} para responder desde la bandeja.`
                  : `El último mensaje de ${nombre} fue hace más de 24 h, así que ${tema.nombre} no permite responder desde acá.`}{' '}
                Para contestarle, hazlo desde la app de {tema.nombre} en el teléfono.
              </p>
              <a
                href={tema.dmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 font-medium ${tema.accent} underline`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir {tema.nombre}
              </a>
            </div>
          </div>
        )}
        {porCerrar && (
          <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>La ventana de 24 h cierra dentro de menos de 1 h — responde ahora o tendrás que seguir desde la app de {tema.nombre}.</span>
          </p>
        )}
        {!bloqueado && sugerencia && sugerencia.escalar ? (
          <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              El agente sugiere derivar a una persona
              {sugerencia.motivo ? `: ${sugerencia.motivo}` : ''}.
            </span>
          </p>
        ) : !bloqueado && sugerencia && sugerencia.texto ? (
          <p className={`flex items-center gap-1.5 text-[11px] font-medium ${tema.accent}`}>
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
            Borrador sugerido por IA — revísalo antes de enviar.
          </p>
        ) : null}
        {alt.chip}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="flex items-end gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,application/pdf"
            onChange={(e) => adjuntar(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={enviando || bloqueado}
            title="Adjuntar foto, PDF, audio o video (máx 16 MB)"
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setBiblioteca(true)}
            disabled={enviando || bloqueado}
            title="Enviar foto/video del catálogo (tinas, cabañas, masajes)"
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <Images className="h-4 w-4" />
          </button>
          {alt.boton}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={2}
            disabled={bloqueado}
            placeholder={bloqueado ? 'Ventana de 24 h cerrada — responde desde la app' : `Responder por ${tema.nombre}…`}
            className={`max-h-[220px] min-h-[58px] w-full resize-y overflow-y-auto rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${tema.focus}`}
          />
          <Button
            type="submit"
            disabled={!input.trim() || enviando || bloqueado}
            className={tema.sendBg}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        <p className="text-[10px] text-slate-400">
          {bloqueado
            ? 'Instagram y Messenger solo permiten responder dentro de las 24 h del último mensaje del cliente.'
            : `Ventana de 24 h abierta${restanteHoras > 1 ? ` · quedan ~${restanteHoras} h` : ''} · Enter envía · Shift+Enter salto de línea · 📎 adjunta foto/PDF/audio/video`}
        </p>
      </div>

      {/* Botón al fondo para volver al listado sin scrollear arriba (solo móvil). */}
      {onVolver && (
        <button
          type="button"
          onClick={onVolver}
          className={`flex flex-shrink-0 items-center justify-center gap-1.5 border-t border-slate-200 bg-slate-50 py-3 text-sm font-medium ${tema.accent} hover:bg-slate-100 md:hidden`}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </button>
      )}
    </section>
  );
}
