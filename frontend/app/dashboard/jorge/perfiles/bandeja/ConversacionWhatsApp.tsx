'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  RefreshCw,
  Send,
  MessageSquare,
  ArrowLeft,
  AlertTriangle,
  FileText,
  Mic,
  Paperclip,
  Phone,
  Copy,
  Check,
  CheckCheck,
  Pencil,
  X,
  Sparkles,
  ChevronUp,
  Images,
  Trash2,
} from 'lucide-react';
import {
  fetchConversacionWhatsApp,
  responderWhatsApp,
  enviarAdjuntoWhatsApp,
  enviarAdjuntoURL,
  editarNombreWhatsApp,
  marcarAtendidoWhatsApp,
  reportarFeedbackAgente,
  telefonoE164,
  limpiarConversacion,
} from './api';
import { BibliotecaMedios } from './BibliotecaMedios';
import type {
  MensajeWhatsApp,
  SugerenciaAgente,
  PropuestaReserva,
  ReservaCreada,
  CarritoEnCurso,
} from './types';
import { CotizacionCajon } from './CotizacionCajon';
import { useAlternativasHorario } from './useAlternativasHorario';

interface ConversacionWhatsAppProps {
  /** Teléfono del cliente en cualquier formato; se normaliza a E.164 internamente. */
  telefono: string;
  nombre: string;
  disabled?: boolean;
  /** Se llama tras enviar una respuesta con éxito (para refrescar listas externas). */
  onReplySent?: () => void;
  /** Se llama tras corregir el nombre del cliente (para refrescar la lista externa). */
  onNombreEditado?: (nombre: string) => void;
  /** Se llama tras marcar la conversación como leída (para refrescar la lista externa). */
  onAtendido?: () => void;
  /** Si se entrega, muestra un botón "← Volver" (solo en móvil) para regresar a la lista. */
  onVolver?: () => void;
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
  onNombreEditado,
  onAtendido,
  onVolver,
}: ConversacionWhatsAppProps) {
  const phone = telefonoE164(telefono);
  const [mensajes, setMensajes] = useState<MensajeWhatsApp[]>([]);
  const [sugerencia, setSugerencia] = useState<SugerenciaAgente | null>(null);
  const [propuesta, setPropuesta] = useState<PropuestaReserva | null>(null);
  const [reservaCreada, setReservaCreada] = useState<ReservaCreada | null>(null);
  const [carrito, setCarrito] = useState<CarritoEnCurso | null>(null); // H-046
  const sugerenciaAplicadaRef = useRef<string | null>(null);
  // Para auto-generar el borrador al llegar un entrante nuevo (sin tocar nada).
  const ultimoInboundRef = useRef<string | null>(null);
  const inicializadoSugRef = useRef(false);
  // Paginación "cargar mensajes antiguos" (Django topea limit a 500).
  const [limite, setLimite] = useState(200);
  const limiteRef = useRef(200);
  limiteRef.current = limite;
  const masAntiguosRef = useRef(false);
  const [cargandoAntiguos, setCargandoAntiguos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviarError, setEnviarError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [biblioteca, setBiblioteca] = useState(false);
  const finRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Alternativas de horario (H-061) — feature compartido con Instagram/Messenger
  // vía useAlternativasHorario (el motor de fondo es agnóstico del canal).
  const alt = useAlternativasHorario({
    onUsarTexto: setTexto,
    disabled: disabled || enviando || !phone,
    resetKey: phone,
    btnClass:
      'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-50',
    ringClass: 'focus:border-emerald-500 focus:ring-emerald-500',
    buscarBtnClass: 'bg-emerald-600 hover:bg-emerald-700',
    accentText: 'text-emerald-700',
    // Con esto el chip de alternativas ofrece «cotizar esta»: crea la cotización
    // sin que Luna haya armado nada. Basta el nombre — el correo y el RUT los
    // pone el cliente al aprobar.
    canal: 'whatsapp',
    externalId: phone,
    nombreCliente: nombre,
    onCotizada: onReplySent,
  });

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

  const [nombreActual, setNombreActual] = useState(nombre);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreInput, setNombreInput] = useState(nombre);
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [nombreError, setNombreError] = useState<string | null>(null);

  // Al cambiar de conversación (phone) se resetea el nombre mostrado y el modo
  // edición. Depende solo de `phone` a propósito: tras editar, el nombre lo fija
  // `guardarNombre` y no debe revertirse por un re-render del padre con el valor
  // viejo antes de que su lista termine de refrescar.
  useEffect(() => {
    setNombreActual(nombre);
    setEditandoNombre(false);
    setNombreError(null);
    setSugerencia(null);
    sugerenciaAplicadaRef.current = null;
    ultimoInboundRef.current = null;
    inicializadoSugRef.current = false;
    setLimite(200);
    limiteRef.current = 200;
    masAntiguosRef.current = false;
    // (Las alternativas de horario se resetean solas: useAlternativasHorario las
    // descarta cuando cambia resetKey = phone.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  // Precarga el cajón con la sugerencia del agente IA (H-007 F1): una sola vez
  // por entrante (responde_a) y solo si el cajón está vacío, para no pisar lo que
  // escriba Deborah. Si la sugerencia escala a humano, no precarga (solo avisa).
  useEffect(() => {
    const s = sugerencia;
    if (!s || s.escalar || !s.texto) return;
    if (s.responde_a && s.responde_a === sugerenciaAplicadaRef.current) return;
    sugerenciaAplicadaRef.current = s.responde_a;
    setTexto((prev) => (prev.trim() === '' ? s.texto : prev));
  }, [sugerencia]);

  const guardarNombre = async () => {
    const n = nombreInput.trim();
    if (!n || guardandoNombre || !phone) return;
    setGuardandoNombre(true);
    setNombreError(null);
    try {
      const r = await editarNombreWhatsApp(phone, n);
      const nuevo = r.cliente_nombre || n;
      setNombreActual(nuevo);
      setEditandoNombre(false);
      onNombreEditado?.(nuevo);
    } catch (e: unknown) {
      setNombreError(e instanceof Error ? e.message : 'No se pudo guardar el nombre');
    } finally {
      setGuardandoNombre(false);
    }
  };

  const [marcandoLeido, setMarcandoLeido] = useState(false);
  const marcarLeido = async () => {
    if (!phone || marcandoLeido) return;
    setMarcandoLeido(true);
    try {
      await marcarAtendidoWhatsApp(phone);
      onAtendido?.();
    } catch {
      // Silencioso: marcar leído es idempotente; si falla, el "1" permanece.
    } finally {
      setMarcandoLeido(false);
    }
  };
  // PRUEBAS: borra el historial + carrito de este teléfono (destructivo → confirma).
  const [borrando, setBorrando] = useState(false);
  const borrarConversacion = async () => {
    if (!phone || borrando) return;
    if (!window.confirm(`⚠️ PRUEBA — Borrar TODOS los mensajes y el carrito de ${phone}?\nEsto no se puede deshacer.`)) return;
    setBorrando(true);
    try {
      await limpiarConversacion(phone);
      await cargar(true);
      onAtendido?.(); // refresca la lista de la izquierda
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'No se pudo borrar la conversación');
    } finally {
      setBorrando(false);
    }
  };
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cargar = useCallback(
    // silencioso = no blanquea el hilo (sin loader). conSug = pedir el borrador
    // del agente IA. Por defecto conSug sigue a !silencioso, pero se desacoplan
    // para que "Actualizar" pida el borrador SIN blanquear (no perder el scroll).
    async (silencioso = false, conSug?: boolean) => {
      if (!phone) {
        setError('Sin teléfono válido para este cliente');
        setCargando(false);
        return;
      }
      if (!silencioso) setCargando(true);
      const pedirSugerencia = conSug ?? !silencioso;
      try {
        const data = await fetchConversacionWhatsApp(phone, limiteRef.current, pedirSugerencia);
        setMensajes(data.messages || []);
        // Solo pisamos la sugerencia cuando la pedimos (el auto-refresco no la
        // pide → conservamos la última).
        if (pedirSugerencia) setSugerencia(data.sugerencia_agente ?? null);
        setPropuesta(data.propuesta_reserva ?? null); // H-028: propuesta pendiente de aprobar
        setReservaCreada(data.reserva_creada ?? null); // H-039: reserva creada por el Aprobar del cliente
        setCarrito(data.carrito_en_curso ?? null); // H-046: carrito en vivo (antes de cotizar)
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error al cargar la conversación');
      } finally {
        setCargando(false);
      }
    },
    [phone]
  );

  // "Actualizar": refresca el hilo y regenera el borrador SIN blanquearlo
  // (silencioso) para no saltar el scroll hacia arriba.
  const [regenerando, setRegenerando] = useState(false);
  const regenerar = async () => {
    if (regenerando) return;
    setRegenerando(true);
    try {
      await cargar(true, true);
    } finally {
      setRegenerando(false);
    }
  };

  // Sube el límite (de a 300, tope 500 de Django) y recarga para traer mensajes
  // más antiguos. Silencioso (no blanquea) y no auto-baja el scroll.
  const cargarAntiguos = async () => {
    if (cargandoAntiguos || limite >= 500) return;
    setCargandoAntiguos(true);
    masAntiguosRef.current = true;
    const nuevo = Math.min(limite + 300, 500);
    limiteRef.current = nuevo;
    setLimite(nuevo);
    try {
      await cargar(true, false);
    } finally {
      setCargandoAntiguos(false);
    }
  };

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

  // Auto-scroll al último mensaje cuando cambia el hilo. Se omite cuando se
  // acaban de cargar mensajes antiguos (el usuario quiere quedarse arriba).
  useEffect(() => {
    if (masAntiguosRef.current) {
      masAntiguosRef.current = false;
      return;
    }
    finRef.current?.scrollIntoView({ block: 'end' });
  }, [mensajes.length]);

  // Auto-alto del cajón: crece con el contenido (hasta un tope) para que el
  // borrador de IA, que suele ser largo, se vea completo sin scrollear.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [texto]);

  // Auto-genera el borrador del agente al llegar un entrante NUEVO (una vez por
  // mensaje), sin tener que tocar "Actualizar". La carga inicial ya pide
  // sugerencia, por eso la primera vez solo registramos el estado.
  useEffect(() => {
    const ins = mensajes.filter((m) => m.direction === 'in');
    const ultId = ins.length ? ins[ins.length - 1].wa_message_id || null : null;
    if (!inicializadoSugRef.current) {
      inicializadoSugRef.current = true;
      ultimoInboundRef.current = ultId;
      return;
    }
    if (ultId && ultId !== ultimoInboundRef.current) {
      ultimoInboundRef.current = ultId;
      cargar(true, true); // entrante nuevo → genera el borrador en silencio
    }
  }, [mensajes, cargar]);

  const handleEnviar = async () => {
    const t = texto.trim();
    if (!t || enviando || disabled) return;
    setEnviando(true);
    setEnviarError(null);
    const sug = sugerencia; // snapshot antes de limpiar
    try {
      await responderWhatsApp(phone, t);
      // Feedback del agente (H-010 p1): si había borrador (no escalado), reporta
      // el delta borrador-vs-enviado. Fire-and-forget, no bloquea ni rompe.
      if (sug && !sug.escalar && sug.texto) {
        void reportarFeedbackAgente({
          phone,
          wa_message_id: sug.responde_a || '',
          borrador: sug.texto,
          enviado: t,
        });
        setSugerencia(null); // borrador consumido
      }
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
      // Devolver el foco al cajón para seguir escribiendo sin tocar el mouse.
      // rAF: el textarea está disabled mientras 'enviando'; esperamos a que el
      // re-render lo re-habilite antes de enfocar (un disabled no recibe foco).
      requestAnimationFrame(() => textareaRef.current?.focus());
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
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  // Enviar una foto/video del catálogo (biblioteca, H-025) por WhatsApp (por URL).
  const enviarDesdeBiblioteca = async (url: string) => {
    if (disabled) return;
    setBiblioteca(false);
    setEnviando(true);
    setEnviarError(null);
    try {
      await enviarAdjuntoURL('whatsapp', phone, url, texto.trim() || undefined);
      setTexto('');
      await cargar(true);
      onReplySent?.();
    } catch (e: unknown) {
      setEnviarError(e instanceof Error ? e.message : 'No se pudo enviar la foto de la biblioteca');
    } finally {
      setEnviando(false);
    }
  };

  const ventanaAbierta = dentroVentana24h(mensajes);

  return (
    <section className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg border border-emerald-200 bg-white">
      {biblioteca && (
        <BibliotecaMedios
          accent="text-emerald-600"
          onClose={() => setBiblioteca(false)}
          onSelect={(url) => enviarDesdeBiblioteca(url)}
        />
      )}
      {alt.modal}
      {/* Encabezado del hilo */}
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/60 px-3 py-2">
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            title="Volver a la lista"
            aria-label="Volver a la lista de conversaciones"
            className="-ml-1 inline-flex flex-shrink-0 items-center rounded-md p-1 text-emerald-700 hover:bg-emerald-100 md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            <MessageSquare className="h-3 w-3" />
            Conversación de WhatsApp
          </span>
          {editandoNombre ? (
            <span className="flex items-center gap-1 py-0.5">
              <input
                value={nombreInput}
                onChange={(e) => setNombreInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') guardarNombre();
                  if (e.key === 'Escape') setEditandoNombre(false);
                }}
                autoFocus
                maxLength={100}
                placeholder="Nombre del cliente"
                className="w-44 rounded border border-emerald-300 px-1.5 py-0.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={guardarNombre}
                disabled={guardandoNombre || !nombreInput.trim()}
                title="Guardar nombre"
                className="inline-flex items-center rounded p-0.5 hover:bg-emerald-100 disabled:opacity-50"
              >
                {guardandoNombre ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setEditandoNombre(false)}
                title="Cancelar"
                className="inline-flex items-center rounded p-0.5 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-emerald-900">
                {nombreActual}
              </span>
              <button
                type="button"
                onClick={() => {
                  setNombreInput(nombreActual);
                  setEditandoNombre(true);
                  setNombreError(null);
                }}
                title="Editar nombre del cliente"
                className="inline-flex flex-shrink-0 items-center rounded p-0.5 text-emerald-600 hover:bg-emerald-100"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </span>
          )}
          {nombreError && <span className="text-[10px] text-red-600">{nombreError}</span>}
          {phone && (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-700">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span className="font-mono">{phone}</span>
              <button
                type="button"
                onClick={copiarTelefono}
                title="Copiar número"
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-emerald-100"
              >
                {copiado ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span className="text-[10px] text-emerald-600">copiado</span>
                  </>
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={marcarLeido}
            disabled={marcandoLeido}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            title="Marcar como leído (sacar de pendientes)"
          >
            {marcandoLeido ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Leído
          </button>
          <button
            type="button"
            onClick={regenerar}
            disabled={cargando || regenerando}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            title="Actualizar conversación y regenerar el borrador del agente"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${cargando || regenerando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={borrarConversacion}
            disabled={borrando || !phone}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            title="PRUEBA: borrar todos los mensajes y el carrito de este teléfono"
          >
            {borrando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Borrar (test)
          </button>
        </div>
      </div>

      {/* Hilo de mensajes */}
      <div className="min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
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
            Sin mensajes de WhatsApp registrados con {nombreActual.split(' ')[0]} todavía.
          </p>
        ) : (
          <>
            {mensajes.length >= limite && limite < 500 && (
              <div className="flex justify-center pb-1">
                <button
                  type="button"
                  onClick={cargarAntiguos}
                  disabled={cargandoAntiguos}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  {cargandoAntiguos ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ChevronUp className="h-3 w-3" />
                  )}
                  Cargar mensajes antiguos
                </button>
              </div>
            )}
            {mensajes.map((m) => {
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
            })}
          </>
        )}
        <div ref={finRef} />
      </div>

      {/* Caja de respuesta */}
      <div className="flex-shrink-0 space-y-2 border-t border-slate-200 p-3">
        {(propuesta || reservaCreada || carrito) && (
          <CotizacionCajon
            propuesta={propuesta}
            reservaCreada={reservaCreada}
            carrito={carrito} // H-046: carrito en vivo (editable desde H-079)
            onUsarTexto={(texto) => setTexto(texto)} // Deborah revisa y lo envía al cliente
            onRefrescar={() => cargar(true)} // H-042: tras editar/cerrar, releer la conversación
            editCanal="whatsapp" // H-079: identidad para corregir el carrito en curso
            editExternalId={phone}
          />
        )}
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
        {sugerencia && sugerencia.escalar && (
          <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-2 text-[11px] text-orange-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              <strong>Derivar a persona.</strong>{' '}
              {sugerencia.motivo || 'El agente IA sugiere que conteste un humano.'}
            </span>
          </div>
        )}
        {sugerencia && !sugerencia.escalar && sugerencia.texto && (
          <div className="flex items-center gap-1.5 text-[11px] text-violet-700">
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Borrador sugerido por IA — revísalo antes de enviar.</span>
          </div>
        )}
        {alt.chip}
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
          <button
            type="button"
            onClick={() => setBiblioteca(true)}
            disabled={disabled || enviando || !phone}
            title="Enviar foto/video del catálogo (tinas, cabañas, masajes)"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <Images className="h-4 w-4" />
          </button>
          {alt.boton}
          <textarea
            ref={textareaRef}
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
            className="max-h-[220px] w-full resize-y overflow-y-auto rounded-lg border border-slate-300 bg-white p-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
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

      {/* Botón al fondo para volver al listado sin tener que scrollear arriba
          a buscar la flecha (solo móvil; en desktop la lista siempre está). */}
      {onVolver && (
        <button
          type="button"
          onClick={onVolver}
          className="flex flex-shrink-0 items-center justify-center gap-1.5 border-t border-slate-200 bg-slate-50 py-3 text-sm font-medium text-emerald-700 hover:bg-slate-100 md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </button>
      )}
    </section>
  );
}
